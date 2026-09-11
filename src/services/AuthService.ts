import {
	ConflictException,
	ForbiddenException,
	HttpStatus,
	Injectable,
	InternalServerErrorException,
	UnauthorizedException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { InjectRepository } from "@nestjs/typeorm";
import {
	createHash,
	randomBytes,
	randomUUID,
	timingSafeEqual
} from "node:crypto";
import {
	EntityManager,
	LessThanOrEqual,
	QueryFailedError,
	Repository
} from "typeorm";
import { JwtPayload } from "../commons/AuthTypes";
import { ERROR_CODES, MYSQL_ERROR } from "../constants/error-codes";
import {
	ROLE_IDS,
	roleFromId,
	USER_STATUS_IDS,
	UserRole,
	userStatusFromId,
	UserStatus
} from "../constants/library";
import {
	AuthResponse,
	LoginDto,
	RegisterDto,
	TokenPairResponse,
	UserResponse
} from "../dtos/AuthDto";
import { AuthSessionEntity } from "../entities/AuthSessionEntity";
import { LibraryUserEntity } from "../entities/LibraryUserEntity";
import { PasswordHasher } from "../utilities/PasswordHasher";
import { TransactionRunner } from "../utilities/TransactionRunner";

const REFRESH_SECRET_BYTES = 32;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const SESSION_ID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REFRESH_SECRET_PATTERN = /^[A-Za-z0-9_-]{43}$/;

interface ParsedRefreshToken {
	sessionId: string;
	secret: string;
}

@Injectable()
export class AuthService {
	private readonly refreshTokenLifetimeMs: number;

	constructor(
		@InjectRepository(LibraryUserEntity)
		private readonly users: Repository<LibraryUserEntity>,
		@InjectRepository(AuthSessionEntity)
		private readonly sessions: Repository<AuthSessionEntity>,
		private readonly passwordHasher: PasswordHasher,
		private readonly jwtService: JwtService,
		private readonly config: ConfigService,
		private readonly transactions: TransactionRunner
	) {
		const lifetimeDays = Number(
			this.config.get<string>("REFRESH_TOKEN_EXPIRES_IN_DAYS") ?? "30"
		);
		if (!Number.isSafeInteger(lifetimeDays) || lifetimeDays <= 0)
			throw new Error(
				"REFRESH_TOKEN_EXPIRES_IN_DAYS must be a positive integer"
			);

		this.refreshTokenLifetimeMs = lifetimeDays * MILLISECONDS_PER_DAY;
	}

	async register(dto: RegisterDto): Promise<AuthResponse> {
		const email = dto.email;

		if (await this.users.exists({ where: { email } }))
			throw this.emailTaken();

		const user = this.users.create({
			id: randomUUID(),
			name: dto.name,
			email,
			passwordHash: await this.passwordHasher.hash(dto.password),
			roleId: ROLE_IDS[UserRole.Member],
			statusId: USER_STATUS_IDS[UserStatus.Active]
		});

		let tokens: TokenPairResponse;
		try {
			tokens = await this.transactions.run(async (manager) => {
				await manager.getRepository(LibraryUserEntity).insert(user);
				return this.createSession(user, manager);
			});
		} catch (error) {
			if (this.isDuplicateEntry(error)) throw this.emailTaken();
			throw error;
		}

		return { user: this.toUserResponse(user), ...tokens };
	}

	async login(dto: LoginDto): Promise<AuthResponse> {
		const user = await this.users.findOne({ where: { email: dto.email } });

		const isPasswordValid = await this.passwordHasher.compare(
			dto.password,
			user?.passwordHash ?? ""
		);

		if (!user || !isPasswordValid) throw this.invalidCredentials();
		if (!this.isActive(user)) throw this.accountInactive();

		return {
			user: this.toUserResponse(user),
			...(await this.createSession(user))
		};
	}

	async refresh(refreshToken: string): Promise<TokenPairResponse> {
		const parsed = this.parseRefreshToken(refreshToken);
		if (!parsed) throw this.invalidRefreshToken();

		const tokens = await this.transactions.run(async (manager) => {
			const sessions = manager.getRepository(AuthSessionEntity);
			const session = await sessions.findOne({
				where: { id: parsed.sessionId },
				lock: { mode: "pessimistic_write" }
			});
			if (!session) return null;

			const suppliedHash = this.hashRefreshSecret(parsed.secret);
			if (
				session.expiresAt.getTime() <= Date.now() ||
				!timingSafeEqual(session.refreshTokenHash, suppliedHash)
			) {
				await sessions.delete({ id: session.id });
				return null;
			}

			const user = await manager.getRepository(LibraryUserEntity).findOne({
				where: { id: session.userId }
			});
			if (!user || !this.isActive(user)) {
				await sessions.delete({ id: session.id });
				return null;
			}

			const nextSecret = this.generateRefreshSecret();
			await sessions.update(
				{ id: session.id },
				{
					refreshTokenHash: this.hashRefreshSecret(nextSecret),
					expiresAt: this.refreshTokenExpiresAt()
				}
			);

			return {
				accessToken: await this.signAccessToken(user, session.id),
				refreshToken: this.formatRefreshToken(session.id, nextSecret)
			};
		});

		if (!tokens) throw this.invalidRefreshToken();
		return tokens;
	}

	async logout(userId: string): Promise<void> {
		const cutoff = new Date(Math.floor(Date.now() / 1000) * 1000);
		await this.transactions.run(async (manager) => {
			await manager
				.getRepository(LibraryUserEntity)
				.update({ id: userId }, { tokensValidFrom: cutoff });
			await manager
				.getRepository(AuthSessionEntity)
				.delete({ userId });
		});
	}

	private async createSession(
		user: LibraryUserEntity,
		manager?: EntityManager
	): Promise<TokenPairResponse> {
		const sessionId = randomUUID();
		const secret = this.generateRefreshSecret();
		const sessions = manager?.getRepository(AuthSessionEntity) ?? this.sessions;
		const accessToken = await this.signAccessToken(user, sessionId);

		await sessions.delete({
			userId: user.id,
			expiresAt: LessThanOrEqual(new Date())
		});
		await sessions.insert(
			sessions.create({
				id: sessionId,
				userId: user.id,
				refreshTokenHash: this.hashRefreshSecret(secret),
				expiresAt: this.refreshTokenExpiresAt()
			})
		);

		return {
			accessToken,
			refreshToken: this.formatRefreshToken(sessionId, secret)
		};
	}

	private signAccessToken(
		user: LibraryUserEntity,
		sessionId: string
	): Promise<string> {
		const payload: JwtPayload = {
			sub: user.id,
			role: this.roleOf(user),
			sid: sessionId
		};
		return this.jwtService.signAsync(payload);
	}

	private generateRefreshSecret(): string {
		return randomBytes(REFRESH_SECRET_BYTES).toString("base64url");
	}

	private hashRefreshSecret(secret: string): Buffer {
		return createHash("sha256").update(secret).digest();
	}

	private formatRefreshToken(sessionId: string, secret: string): string {
		return `${sessionId}.${secret}`;
	}

	private parseRefreshToken(token: string): ParsedRefreshToken | null {
		const parts = token.split(".");
		if (
			parts.length !== 2 ||
			!SESSION_ID_PATTERN.test(parts[0]) ||
			!REFRESH_SECRET_PATTERN.test(parts[1])
		)
			return null;

		return { sessionId: parts[0], secret: parts[1] };
	}

	private refreshTokenExpiresAt(): Date {
		return new Date(Date.now() + this.refreshTokenLifetimeMs);
	}

	private toUserResponse(user: LibraryUserEntity): UserResponse {
		return {
			id: user.id,
			name: user.name,
			email: user.email,
			role: this.roleOf(user)
		};
	}

	private isActive(user: LibraryUserEntity): boolean {
		return userStatusFromId(user.statusId) === UserStatus.Active;
	}

	private roleOf(user: LibraryUserEntity): UserRole {
		const role = roleFromId(user.roleId);
		if (!role) throw this.unknownRole();
		return role;
	}

	private isDuplicateEntry(error: unknown): boolean {
		return (
			error instanceof QueryFailedError &&
			(error.driverError as { errno?: number } | undefined)?.errno ===
				MYSQL_ERROR.DUP_ENTRY
		);
	}

	private invalidCredentials(): UnauthorizedException {
		return new UnauthorizedException({
			statusCode: HttpStatus.UNAUTHORIZED,
			code: ERROR_CODES.INVALID_CREDENTIALS,
			message: "Incorrect email or password!"
		});
	}

	private invalidRefreshToken(): UnauthorizedException {
		return new UnauthorizedException({
			statusCode: HttpStatus.UNAUTHORIZED,
			code: ERROR_CODES.INVALID_REFRESH_TOKEN,
			message: "Refresh token is invalid or expired. Please log in again."
		});
	}

	private accountInactive(): ForbiddenException {
		return new ForbiddenException({
			statusCode: HttpStatus.FORBIDDEN,
			code: ERROR_CODES.ACCOUNT_INACTIVE,
			message:
				"This account is inactive. Please contact the library admin."
		});
	}

	private unknownRole(): InternalServerErrorException {
		return new InternalServerErrorException({
			statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
			code: ERROR_CODES.INVALID_REFERENCE,
			message: "Account role is not recognised. Please contact support."
		});
	}

	private emailTaken(): ConflictException {
		return new ConflictException({
			statusCode: HttpStatus.CONFLICT,
			code: ERROR_CODES.EMAIL_TAKEN,
			message: "Email already registered!"
		});
	}
}
