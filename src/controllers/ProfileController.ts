import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Patch,
	Req
} from "@nestjs/common";
import { AllowMobile } from "../commons/AllowMobile";
import { AuthenticatedRequest, AuthenticatedUser } from "../commons/AuthTypes";
import { CurrentUser } from "../commons/CurrentUser";
import { ProfileResponse, UpdateProfileDto } from "../dtos/ProfileDto";
import { ProfileService } from "../services/ProfileService";

@Controller("profile")
export class ProfileController {
	constructor(private readonly profileService: ProfileService) {}

	/** `Platform: Mobile` with the magic-link JWT returns only the mobile account's name and email. */
	@Get()
	@AllowMobile()
	@HttpCode(HttpStatus.OK)
	async getProfile(
		@Req() request: AuthenticatedRequest
	): Promise<ProfileResponse | { name: string | null; email: string }> {
		if (request.mobileUser)
			return { name: request.mobileUser.name, email: request.mobileUser.email };
		return this.profileService.getProfile(request.user!.id);
	}

	/** Takes the whole {@link AuthenticatedUser} — the service needs the role to gate `role`/`status`. */
	@Patch()
	@HttpCode(HttpStatus.OK)
	async updateProfile(
		@CurrentUser() user: AuthenticatedUser,
		@Body() dto: UpdateProfileDto
	): Promise<ProfileResponse> {
		return this.profileService.updateProfile(user, dto);
	}
}
