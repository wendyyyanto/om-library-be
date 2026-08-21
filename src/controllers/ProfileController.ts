import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Patch
} from "@nestjs/common";
import { AuthenticatedUser } from "../commons/AuthTypes";
import { CurrentUser } from "../commons/CurrentUser";
import { ProfileResponse, UpdateProfileDto } from "../dtos/ProfileDto";
import { ProfileService } from "../services/ProfileService";

@Controller("profile")
export class ProfileController {
	constructor(private readonly profileService: ProfileService) {}

	@Get()
	@HttpCode(HttpStatus.OK)
	async getProfile(
		@CurrentUser("id") userId: string
	): Promise<ProfileResponse> {
		return this.profileService.getProfile(userId);
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
