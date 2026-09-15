import { Transform } from "class-transformer";
import {
	IsInt,
	IsNotEmpty,
	IsOptional,
	IsString,
	MaxLength,
	Min
} from "class-validator";

function trim(value: unknown): unknown {
	return typeof value === "string" ? value.trim() : value;
}

export class CreateClassDto {
	@Transform(({ value }) => trim(value))
	@IsString({ message: "Title must be text!" })
	@IsNotEmpty({ message: "Title is required!" })
	@MaxLength(255, { message: "Title must be at most 255 characters!" })
	title: string;

	@IsOptional()
	@Transform(({ value }) => trim(value))
	@IsString({ message: "Description must be text!" })
	description?: string | null;

	@IsOptional()
	@IsInt({ message: "Total weeks must be a positive integer!" })
	@Min(1, { message: "Total weeks must be a positive integer!" })
	total_weeks?: number | null;

	@IsInt({ message: "Class category ID must be a positive integer!" })
	@Min(1, { message: "Class category ID must be a positive integer!" })
	class_category_id: number;
}

export interface ClassCategoryResponse {
	id: number;
	label: string;
}

export interface ClassUploaderResponse {
	id: string;
	name: string;
}

export interface CreatedClassResponse {
	id: number;
	title: string;
	description: string | null;
	total_weeks: number | null;
	class_category: ClassCategoryResponse;
	created_at: string;
	updated_at: string;
	uploaded_by: ClassUploaderResponse;
}

export interface CreateClassResponse {
	data: CreatedClassResponse;
}
