import {
	ConflictException,
	ForbiddenException,
	HttpStatus,
	Injectable,
	InternalServerErrorException,
	UnauthorizedException
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { InjectRepository } from "@nestjs/typeorm";
import { randomUUID } from "node:crypto";
import { QueryFailedError, Repository } from "typeorm";
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
	UserResponse
} from "../dtos/AuthDto";
import { LibraryUserEntity } from "../entities/LibraryUserEntity";
import { PasswordHasher } from "../utilities/PasswordHasher";

@Injectable()
export class AuthService {
	constructor(
		@InjectRepository(LibraryUserEntity)
		private readonly users: Repository<LibraryUserEntity>,
		private readonly passwordHasher: PasswordHasher,
		private readonly jwtService: JwtService
	) {}

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

		try {
			await this.users.insert(user);
		} catch (error) {
			if (this.isDuplicateEntry(error)) throw this.emailTaken();
			throw error;
		}

		return {
			user: this.toUserResponse(user),
			accessToken: await this.signAccessToken(user)
		};
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
			accessToken: await this.signAccessToken(user)
		};
	}

	async logout(userId: string): Promise<void> {
		const cutoff = new Date(Math.floor(Date.now() / 1000) * 1000);
		await this.users.update({ id: userId }, { tokensValidFrom: cutoff });
	}

	private signAccessToken(user: LibraryUserEntity): Promise<string> {
		const payload: JwtPayload = { sub: user.id, role: this.roleOf(user) };
		return this.jwtService.signAsync(payload);
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
