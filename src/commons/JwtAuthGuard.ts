import {
	CanActivate,
	ExecutionContext,
	Injectable,
	UnauthorizedException
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ERROR_CODES } from "../constants/error-codes";
import { UserRole } from "../constants/library";
import { LibraryUserEntity } from "../entities/LibraryUserEntity";
import { AuthenticatedRequest, JwtPayload } from "./AuthTypes";
import { IS_PUBLIC_KEY } from "./Public";

@Injectable()
export class JwtAuthGuard implements CanActivate {
	constructor(
		private readonly reflector: Reflector,
		private readonly jwtService: JwtService,
		@InjectRepository(LibraryUserEntity)
		private readonly users: Repository<LibraryUserEntity>
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const isPublic = this.reflector.getAllAndOverride<boolean>(
			IS_PUBLIC_KEY,
			[context.getHandler(), context.getClass()]
		);
		if (isPublic) return true;

		const request = context
			.switchToHttp()
			.getRequest<AuthenticatedRequest>();
		const token = this.extractToken(request);
		if (!token) throw this.unauthorized();

		let payload: JwtPayload;
		try {
			payload = await this.jwtService.verifyAsync<JwtPayload>(token);
		} catch {
			throw this.unauthorized();
		}

		if (!payload.sub || !Object.values(UserRole).includes(payload.role))
			throw this.unauthorized();

		if (await this.isRevoked(payload)) throw this.sessionRevoked();

		request.user = { id: payload.sub, role: payload.role };
		return true;
	}

	private async isRevoked(payload: JwtPayload): Promise<boolean> {
		if (payload.iat === undefined) return true;

		const user = await this.users.findOne({
			where: { id: payload.sub },
			select: { id: true, tokensValidFrom: true }
		});
		if (!user) return true;

		const validFrom = Math.floor(user.tokensValidFrom.getTime() / 1000);
		return payload.iat < validFrom;
	}

	private extractToken(request: AuthenticatedRequest): string | null {
		const header = request.headers.authorization;
		if (!header) return null;
		const [scheme, value] = header.split(" ");
		return scheme?.toLowerCase() === "bearer" && value ? value : null;
	}

	private unauthorized(): UnauthorizedException {
		return new UnauthorizedException({
			statusCode: 401,
			code: ERROR_CODES.UNAUTHORIZED,
			message: "Invalid session. Please log in again."
		});
	}

	/** Distinct from {@link unauthorized} so a client can tell "signed out" from "bad token". */
	private sessionRevoked(): UnauthorizedException {
		return new UnauthorizedException({
			statusCode: 401,
			code: ERROR_CODES.SESSION_REVOKED,
			message: "Session ended. Please log in again."
		});
	}
}
