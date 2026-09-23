import { Transform, Type } from "class-transformer";
import {
	Allow,
	ArrayMaxSize,
	ArrayMinSize,
	ArrayUnique,
	IsArray,
	IsIn,
	IsInt,
	IsNotEmpty,
	IsOptional,
	IsString,
	Max,
	MaxLength,
	Min,
	ValidateNested
} from "class-validator";
import { PaginationResponse } from "./PaginationDto";

export const DROPDOWN_OPERATORS = [
	"like",
	"in",
	"eq",
	"ne",
	"gt",
	"gte",
	"lt",
	"lte",
	"is",
	"is_not"
] as const;

export const DROPDOWN_LOGICALS = ["and", "or"] as const;

function trim(value: unknown): unknown {
	return typeof value === "string" ? value.trim() : value;
}

function trimArray(value: unknown): unknown {
	return Array.isArray(value) ? value.map((item) => trim(item)) : value;
}

export class DropdownFilterDto {
	@Transform(({ value }) => trim(value))
	@IsString({ message: "Filter key must be text!" })
	@IsNotEmpty({ message: "Filter key is required!" })
	@MaxLength(64, { message: "Filter key must be at most 64 characters!" })
	key: string;

	@Transform(({ value }) =>
		typeof value === "string" ? value.toLowerCase() : value
	)
	@IsIn(DROPDOWN_OPERATORS, { message: "Filter operator is invalid!" })
	operator: (typeof DROPDOWN_OPERATORS)[number];

	@Allow()
	value: unknown;

	@IsOptional()
	@Transform(({ value }) =>
		typeof value === "string" ? value.toLowerCase() : value
	)
	@IsIn(DROPDOWN_LOGICALS, { message: "Filter logical value is invalid!" })
	logical?: (typeof DROPDOWN_LOGICALS)[number];
}

export class DropdownRequestDto {
	@Transform(({ value }) => trim(value))
	@IsString({ message: "Entity must be text!" })
	@IsNotEmpty({ message: "Entity is required!" })
	@MaxLength(64, { message: "Entity must be at most 64 characters!" })
	entity: string;

	@Transform(({ value }) => trimArray(value))
	@IsArray({ message: "Attributes must be an array!" })
	@ArrayMinSize(2, { message: "Exactly two attributes are required!" })
	@ArrayMaxSize(2, { message: "Exactly two attributes are required!" })
	@ArrayUnique({ message: "Attributes must not contain duplicates!" })
	@IsString({ each: true, message: "Every attribute must be text!" })
	@IsNotEmpty({ each: true, message: "Attributes must not be empty!" })
	@MaxLength(64, {
		each: true,
		message: "Attributes must be at most 64 characters!"
	})
	attributes: string[];

	@IsOptional()
	@IsArray({ message: "Filters must be an array!" })
	@ArrayMaxSize(10, { message: "At most 10 filters are allowed!" })
	@ValidateNested({ each: true })
	@Type(() => DropdownFilterDto)
	filters?: DropdownFilterDto[];

	@IsOptional()
	@Allow()
	sort_by?: unknown;

	@IsOptional()
	@IsIn([0, 1], { message: "is_paginated must be either 0 or 1!" })
	is_paginated?: 0 | 1;

	@IsOptional()
	@IsInt({ message: "Page must be a positive integer!" })
	@Min(1, { message: "Page must be a positive integer!" })
	page?: number;

	@IsOptional()
	@IsInt({ message: "Limit must be an integer from 1 to 50!" })
	@Min(1, { message: "Limit must be an integer from 1 to 50!" })
	@Max(50, { message: "Limit must be an integer from 1 to 50!" })
	limit?: number;
}

export type DropdownValue = string | number | boolean | null;

export interface DropdownOption {
	id: DropdownValue;
	name: DropdownValue;
}

export interface DropdownResponse {
	data: DropdownOption[];
}

export interface PaginatedDropdownResponse extends DropdownResponse {
	pagination: PaginationResponse;
}
