import { Transform } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";
import { MobileApprovalStatus } from "../entities/MobileUserEntity";
import { GetPaginationQueryDto } from "./PaginationDto";

export interface MobileUserResponse {
	id: string;
	name: string | null;
	email: string;
	approval_status: number;
}

export class GetUsersQueryDto extends GetPaginationQueryDto {
	@IsOptional()
	@Transform(({ value }) =>
		typeof value !== "string" ? value : value.trim() === "" ? undefined : Number(value)
	)
	@IsInt({ message: "approval_status must be an integer!" })
	@IsIn(Object.values(MobileApprovalStatus).filter((v) => typeof v === "number"), {
		message: "approval_status must be 0 (pending), 1 (approved), or 2 (rejected)!"
	})
	approval_status?: MobileApprovalStatus;

	@IsOptional()
	@Transform(({ value }) =>
		typeof value !== "string" ? value : value.trim() || undefined
	)
	@IsString({ message: "Name must be text!" })
	@MaxLength(255, { message: "Name must be at most 255 characters!" })
	name?: string;
}

export class UserApprovalParamsDto {
	@IsUUID(undefined, { message: "User ID must be a valid UUID!" })
	id: string;
}

export class UpdateUserApprovalDto {
	@IsInt({ message: "is_approved must be an integer!" })
	@IsIn([0, 1], { message: "is_approved must be 0 or 1!" })
	is_approved: number;
}
