import {
	BadRequestException,
	Body,
	Controller,
	Get,
	Headers,
	HttpCode,
	HttpStatus,
	Post,
	Query,
	Res
} from "@nestjs/common";
import { Response } from "express";
import { CurrentUser } from "../commons/CurrentUser";
import { Public } from "../commons/Public";
import { createValidationPipe } from "../commons/ValidationPipe";
import { ERROR_CODES } from "../constants/error-codes";
import {
	AuthResponse,
	LoginDto,
	RefreshTokenDto,
	RegisterDto,
	TokenPairResponse
} from "../dtos/AuthDto";
import { AuthService } from "../services/AuthService";
import { MobileAuthService } from "../services/MobileAuthService";

type Platform = "website" | "mobile";

/**
 * `register` and `login` serve two account systems on one route, picked by the `Platform`
 * header: `Website` (default when absent) → `library_users`, `Mobile` → the mobile app's `users`.
 * Their bodies differ, so they're typed loosely here (the global pipe skips them) and each
 * branch validates its own shape.
 */
@Controller("auth")
export class AuthController {
	private readonly validation = createValidationPipe();

	constructor(
		private readonly authService: AuthService,
		private readonly mobileAuthService: MobileAuthService
	) {}

	@Public()
	@Post("register")
	@HttpCode(HttpStatus.CREATED)
	async register(
		@Headers("platform") platform: string | undefined,
		@Body() body: Record<string, unknown>
	): Promise<AuthResponse | { message: string }> {
		if (this.platform(platform) === "mobile")
			return this.mobileAuthService.register(body ?? {});
		return this.authService.register(await this.validate(body, RegisterDto));
	}

	@Public()
	@Post("login")
	@HttpCode(HttpStatus.OK)
	async login(
		@Headers("platform") platform: string | undefined,
		@Body() body: Record<string, unknown>
	): Promise<AuthResponse | { message: string }> {
		if (this.platform(platform) === "mobile")
			return this.mobileAuthService.login(body ?? {});
		return this.authService.login(await this.validate(body, LoginDto));
	}

	@Public()
	@Post("refresh")
	@HttpCode(HttpStatus.OK)
	async refresh(@Body() dto: RefreshTokenDto): Promise<TokenPairResponse> {
		return this.authService.refresh(dto.refreshToken);
	}

	@Post("logout")
	@HttpCode(HttpStatus.NO_CONTENT)
	async logout(@CurrentUser("id") userId: string): Promise<void> {
		return this.authService.logout(userId);
	}

	/** Mobile only. Opened from the emailed login link, so no `Platform` header is expected. */
	@Public()
	@Get("verify")
	async verify(@Query("token") token: string | undefined, @Res() res: Response): Promise<void> {
		if (!token) {
			res.status(400).type("text").send("Token tidak ditemukan");
			return;
		}

		const result = await this.mobileAuthService.verify(String(token));
		if (!result.ok) {
			res.status(result.status).type("text").send(result.message);
			return;
		}

		const next = this.mobileAuthService.verifiedResponse(result.user, result.token);
		if ("html" in next) res.status(200).type("html").send(next.html);
		else res.redirect(302, next.redirect);
	}


	private platform(header: string | undefined): Platform {
		const value = (header ?? "website").trim().toLowerCase();
		if (value === "website" || value === "mobile") return value;
		throw new BadRequestException({
			statusCode: 400,
			code: ERROR_CODES.VALIDATION_FAILED,
			message: "Platform header must be Website or Mobile."
		});
	}

	private validate<T>(body: unknown, metatype: new () => T): Promise<T> {
		return this.validation.transform(body ?? {}, { type: "body", metatype });
	}
}
