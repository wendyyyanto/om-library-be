import { Transform } from "class-transformer";
import {
	IsIn,
	IsInt,
	IsOptional,
	IsString,
	MaxLength,
	MinLength
} from "class-validator";
import {
	ROLE_ID_VALUES,
	ROLE_IDS,
	USER_STATUS_ID_VALUES,
	USER_STATUS_IDS,
	UserRole,
	UserStatus
} from "../constants/library";

export interface ProfileResponse {
	id: string;
	name: string;
	email: string;
	role: UserRole;
	status: UserStatus;
}

function allowedIdsMessage(field: string, ids: Record<string, number>): string {
	const options = Object.entries(ids)
		.map(([name, id]) => `${id} (${name})`)
		.join(", ");
	return `${field} must be one of: ${options}!`;
}

export class UpdateProfileDto {
	@IsOptional()
	@IsString({ message: "Name must be text!" })
	@MinLength(2, { message: "Name must be at least 2 characters!" })
	@MaxLength(255, { message: "Name must be less than 255 characters!" })
	@Transform(({ value }) =>
		typeof value === "string" ? value.trim() : value
	)
	name?: string;

	@IsOptional()
	@IsInt({ message: "Role must be a number!" })
	@IsIn(ROLE_ID_VALUES, { message: allowedIdsMessage("Role", ROLE_IDS) })
	role?: number;

	@IsOptional()
	@IsInt({ message: "Status must be a number!" })
	@IsIn(USER_STATUS_ID_VALUES, {
		message: allowedIdsMessage("Status", USER_STATUS_IDS)
	})
	status?: number;
}
