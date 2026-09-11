import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { CurrentUser } from "../commons/CurrentUser";
import { Public } from "../commons/Public";
import {
	AuthResponse,
	LoginDto,
	RefreshTokenDto,
	RegisterDto,
	TokenPairResponse
} from "../dtos/AuthDto";
import { AuthService } from "../services/AuthService";

@Controller("auth")
export class AuthController {
	constructor(private readonly authService: AuthService) {}

	@Public()
	@Post("register")
	@HttpCode(HttpStatus.CREATED)
	async register(@Body() dto: RegisterDto): Promise<AuthResponse> {
		return this.authService.register(dto);
	}

	@Public()
	@Post("login")
	@HttpCode(HttpStatus.OK)
	async login(@Body() dto: LoginDto): Promise<AuthResponse> {
		return this.authService.login(dto);
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
}
