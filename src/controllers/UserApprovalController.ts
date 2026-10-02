import {
	Body,
	Controller,
	HttpCode,
	HttpStatus,
	Param,
	Put,
	UseGuards
} from "@nestjs/common";
import { Roles } from "../commons/Roles";
import { RolesGuard } from "../commons/RolesGuard";
import { UserRole } from "../constants/library";
import {
	UpdateUserApprovalDto,
	UserApprovalParamsDto
} from "../dtos/UserApprovalDto";
import { MobileAuthService } from "../services/MobileAuthService";

/** Admin approval of mobile `users` accounts. */
@UseGuards(RolesGuard)
@Controller("user-approval")
export class UserApprovalController {
	constructor(private readonly mobileAuthService: MobileAuthService) {}

	@Roles(UserRole.Admin)
	@Put(":id")
	@HttpCode(HttpStatus.OK)
	async update(
		@Param() params: UserApprovalParamsDto,
		@Body() dto: UpdateUserApprovalDto
	): Promise<{ id: string; approval_status: number }> {
		return this.mobileAuthService.setApproval(params.id, dto.is_approved);
	}
}
