import {
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Query,
	UseGuards
} from "@nestjs/common";
import { Roles } from "../commons/Roles";
import { RolesGuard } from "../commons/RolesGuard";
import { UserRole } from "../constants/library";
import { PaginatedResponse } from "../dtos/PaginationDto";
import { GetUsersQueryDto, MobileUserResponse } from "../dtos/UserApprovalDto";
import { MobileAuthService } from "../services/MobileAuthService";

/** Admin listing of mobile `users` accounts. */
@UseGuards(RolesGuard)
@Controller("users")
export class UsersController {
	constructor(private readonly mobileAuthService: MobileAuthService) {}

	@Roles(UserRole.Admin)
	@Get()
	@HttpCode(HttpStatus.OK)
	async list(
		@Query() query: GetUsersQueryDto
	): Promise<PaginatedResponse<MobileUserResponse>> {
		return this.mobileAuthService.listUsers(query);
	}
}
