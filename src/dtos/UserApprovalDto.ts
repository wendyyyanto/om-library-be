import { IsIn, IsInt, IsUUID } from "class-validator";

export class UserApprovalParamsDto {
	@IsUUID(undefined, { message: "User ID must be a valid UUID!" })
	id: string;
}

export class UpdateUserApprovalDto {
	@IsInt({ message: "is_approved must be an integer!" })
	@IsIn([0, 1], { message: "is_approved must be 0 or 1!" })
	is_approved: number;
}
