import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { CurrentUser } from "../commons/CurrentUser";
import { Public } from "../commons/Public";
import { AuthResponse, LoginDto, RegisterDto } from "../dtos/AuthDto";
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

	@Post("logout")
	@HttpCode(HttpStatus.NO_CONTENT)
	async logout(@CurrentUser("id") userId: string): Promise<void> {
		return this.authService.logout(userId);
	}
}
