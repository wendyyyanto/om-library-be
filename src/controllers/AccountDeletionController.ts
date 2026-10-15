import {
	Controller,
	Delete,
	ForbiddenException,
	HttpCode,
	HttpStatus,
	Req
} from "@nestjs/common";
import { AllowMobile } from "../commons/AllowMobile";
import { AuthenticatedRequest } from "../commons/AuthTypes";
import { MobileAuthService } from "../services/MobileAuthService";

@Controller("account-deletion")
export class AccountDeletionController {
	constructor(private readonly mobileAuthService: MobileAuthService) {}

	@Delete()
	@AllowMobile()
	@HttpCode(HttpStatus.NO_CONTENT)
	async delete(@Req() request: AuthenticatedRequest): Promise<void> {
		if (!request.mobileUser)
			throw new ForbiddenException({
				message: "Only mobile accounts can be deleted here."
			});
		return this.mobileAuthService.softDeleteUser(request.mobileUser.id);
	}
}
