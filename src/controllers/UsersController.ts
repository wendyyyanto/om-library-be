import {
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Query,
	UseGuards
} from "@nestjs/common";
import { Roles } from "../commons/Roles";
import { RolesGuard } from "../commons/RolesGuard";
import { UserRole } from "../constants/library";
import { PaginatedResponse } from "../dtos/PaginationDto";
import {
	GetUsersQueryDto,
	MobileUserResponse,
	UserApprovalParamsDto
} from "../dtos/UserApprovalDto";
import { MobileAuthService } from "../services/MobileAuthService";

/** Admin listing and soft deletion of mobile `users` accounts. */
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

	@Roles(UserRole.Admin)
	@Delete(":id")
	@HttpCode(HttpStatus.NO_CONTENT)
	async delete(@Param() params: UserApprovalParamsDto): Promise<void> {
		return this.mobileAuthService.softDeleteUser(params.id);
	}
}
