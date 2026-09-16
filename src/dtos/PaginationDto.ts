import { Transform } from "class-transformer";
import { IsInt, IsOptional, Max, Min } from "class-validator";

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 10;
export const MAX_LIMIT = 50;

function toNumber(value: unknown): unknown {
	return typeof value === "string" ? Number(value) : value;
}

export class GetPaginationQueryDto {
	@IsOptional()
	@Transform(({ value }) => toNumber(value))
	@IsInt({ message: "Page must be a positive integer!" })
	@Min(1, { message: "Page must be a positive integer!" })
	page?: number;

	@IsOptional()
	@Transform(({ value }) => toNumber(value))
	@IsInt({ message: "Limit must be an integer from 1 to 50!" })
	@Min(1, { message: "Limit must be an integer from 1 to 50!" })
	@Max(MAX_LIMIT, { message: "Limit must be an integer from 1 to 50!" })
	limit?: number;
}

export interface PaginationResponse {
	page: number;
	limit: number;
	total_items: number;
	total_pages: number;
}

export interface PaginatedResponse<T> {
	data: T[];
	pagination: PaginationResponse;
}
