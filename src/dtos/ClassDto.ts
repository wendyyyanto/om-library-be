import { Transform } from "class-transformer";
import {
	IsDefined,
	IsInt,
	IsNotEmpty,
	IsOptional,
	IsString,
	IsUUID,
	MaxLength,
	Min,
	ValidateIf
} from "class-validator";
import { PaginatedResponse } from "./PaginationDto";

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

export class UpdateClassDto {
	@Transform(({ value }) => trim(value))
	@IsString({ message: "Title must be text!" })
	@IsNotEmpty({ message: "Title is required!" })
	@MaxLength(255, { message: "Title must be at most 255 characters!" })
	title: string;

	@IsDefined({
		message:
			"Description is required; use null when there is no description!"
	})
	@ValidateIf((_object, value) => value !== null)
	@Transform(({ value }) => trim(value))
	@IsString({ message: "Description must be text!" })
	description: string | null;

	@IsDefined({
		message: "Total weeks is required; use null when there is no total!"
	})
	@ValidateIf((_object, value) => value !== null)
	@IsInt({ message: "Total weeks must be a positive integer!" })
	@Min(1, { message: "Total weeks must be a positive integer!" })
	total_weeks: number | null;

	@IsInt({ message: "Class category ID must be a positive integer!" })
	@Min(1, { message: "Class category ID must be a positive integer!" })
	class_category_id: number;
}

export class GetClassParamsDto {
	@Transform(({ value }) =>
		typeof value === "string" ? Number(value) : value
	)
	@IsInt({ message: "Class ID must be a positive integer!" })
	@Min(1, { message: "Class ID must be a positive integer!" })
	id: number;
}

export class CreateClassMaterialDto {
	@IsOptional()
	@IsInt({ message: "Week must be a positive integer!" })
	@Min(1, { message: "Week must be a positive integer!" })
	week?: number | null;

	@Transform(({ value }) => trim(value))
	@IsString({ message: "Title must be text!" })
	@IsNotEmpty({ message: "Title is required!" })
	@MaxLength(255, { message: "Title must be at most 255 characters!" })
	title: string;

	@IsDefined({ message: "File ID is required!" })
	@IsUUID("4", { message: "File ID must be a valid UUID!" })
	file_id: string;
}

export class UpdateClassMaterialParamsDto {
	@Transform(({ value }) =>
		typeof value === "string" ? Number(value) : value
	)
	@IsInt({ message: "Class ID must be a positive integer!" })
	@Min(1, { message: "Class ID must be a positive integer!" })
	classId: number;

	@Transform(({ value }) =>
		typeof value === "string" ? Number(value) : value
	)
	@IsInt({ message: "Material ID must be a positive integer!" })
	@Min(1, { message: "Material ID must be a positive integer!" })
	materialId: number;
}

export class UpdateClassMaterialDto {
	@Transform(({ value }) => trim(value))
	@IsString({ message: "Title must be text!" })
	@IsNotEmpty({ message: "Title is required!" })
	@MaxLength(255, { message: "Title must be at most 255 characters!" })
	title: string;

	@IsDefined({ message: "Week is required; use null when there is no week!" })
	@ValidateIf((_object, value) => value !== null)
	@IsInt({ message: "Week must be a positive integer!" })
	@Min(1, { message: "Week must be a positive integer!" })
	week: number | null;

	@IsDefined({ message: "File ID is required!" })
	@IsUUID("4", { message: "File ID must be a valid UUID!" })
	file_id: string;
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

export interface ClassMaterialFileResponse {
	id: string;
	file_name: string;
	content_type: string;
	size_bytes: number | null;
	url: string | null;
}

export interface CreatedClassMaterialResponse {
	id: number;
	class_id: number;
	week: number | null;
	title: string;
	upload_path: string;
	file: ClassMaterialFileResponse;
	created_at: string;
	updated_at: string;
}

export interface CreateClassMaterialResponse {
	data: CreatedClassMaterialResponse;
}

export type UpdateClassMaterialResponse = CreateClassMaterialResponse;

export interface ClassListItemResponse {
	id: number;
	title: string;
	total_weeks: number | null;
	class_category: ClassCategoryResponse;
	uploaded_by: ClassUploaderResponse;
	created_at: string;
	updated_at: string;
}

export type ClassesListResponse = PaginatedResponse<ClassListItemResponse>;

export interface ClassMaterialDetailResponse {
	id: number;
	week: number | null;
	title: string;
	file: ClassMaterialFileResponse;
	created_at: string;
	updated_at: string;
}

export interface ClassDetailDataResponse {
	id: number;
	title: string;
	description: string | null;
	total_weeks: number | null;
	class_category: ClassCategoryResponse;
	uploaded_by: ClassUploaderResponse;
	materials: ClassMaterialDetailResponse[];
	created_at: string;
	updated_at: string;
}

export interface ClassDetailResponse {
	data: ClassDetailDataResponse;
}

export type UpdateClassResponse = ClassDetailResponse;
