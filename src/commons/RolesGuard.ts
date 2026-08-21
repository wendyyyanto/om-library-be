import {
	CanActivate,
	ExecutionContext,
	ForbiddenException,
	Injectable
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ERROR_CODES } from "../constants/error-codes";
import { UserRole } from "../constants/library";
import { AuthenticatedRequest } from "./AuthTypes";
import { ROLES_KEY } from "./Roles";

@Injectable()
export class RolesGuard implements CanActivate {
	constructor(private readonly reflector: Reflector) {}

	canActivate(context: ExecutionContext): boolean {
		const required = this.reflector.getAllAndOverride<UserRole[]>(
			ROLES_KEY,
			[context.getHandler(), context.getClass()]
		);
		if (!required?.length) return true;

		const user = context
			.switchToHttp()
			.getRequest<AuthenticatedRequest>().user;
		if (!user || !required.includes(user.role)) throw this.forbidden();

		return true;
	}

	private forbidden(): ForbiddenException {
		return new ForbiddenException({
			statusCode: 403,
			code: ERROR_CODES.FORBIDDEN,
			message: "You do not have access to this feature."
		});
	}
}
