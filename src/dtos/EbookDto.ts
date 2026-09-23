import { Transform } from "class-transformer";
import {
	IsDefined,
	ArrayNotEmpty,
	ArrayUnique,
	IsArray,
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

export class GetEbookParamsDto {
	@IsUUID(undefined, { message: "Ebook ID must be a valid UUID!" })
	id: string;
}

export class CreateEbookDto {
	@Transform(({ value }) => trim(value))
	@IsString({ message: "Title must be text!" })
	@IsNotEmpty({ message: "Title is required!" })
	@MaxLength(255, { message: "Title must be at most 255 characters!" })
	title: string;

	@Transform(({ value }) => trim(value))
	@IsString({ message: "Author must be text!" })
	@IsNotEmpty({ message: "Author is required!" })
	@MaxLength(255, { message: "Author must be at most 255 characters!" })
	author: string;

	@Transform(({ value }) => trim(value))
	@IsString({ message: "Language must be text!" })
	@IsNotEmpty({ message: "Language is required!" })
	@MaxLength(35, { message: "Language must be at most 35 characters!" })
	language: string;

	@IsOptional()
	@IsInt({ message: "Total pages must be a positive integer!" })
	@Min(1, { message: "Total pages must be a positive integer!" })
	total_pages?: number | null;

	@IsOptional()
	@IsUUID("4", { message: "Cover file ID must be a valid UUID!" })
	cover_file_id?: string | null;

	@IsUUID("4", { message: "Ebook file ID must be a valid UUID!" })
	ebook_file_id: string;

	@IsOptional()
	@Transform(({ value }) => trim(value))
	@IsString({ message: "Overview must be text!" })
	overview?: string | null;

	@IsArray({ message: "Tag IDs must be an array!" })
	@ArrayNotEmpty({ message: "At least one tag ID is required!" })
	@ArrayUnique({ message: "Tag IDs must not contain duplicates!" })
	@IsInt({ each: true, message: "Every tag ID must be a positive integer!" })
	@Min(1, {
		each: true,
		message: "Every tag ID must be a positive integer!"
	})
	tag_ids: number[];
}

export class UpdateEbookDto {
	@Transform(({ value }) => trim(value))
	@IsString({ message: "Title must be text!" })
	@IsNotEmpty({ message: "Title is required!" })
	@MaxLength(255, { message: "Title must be at most 255 characters!" })
	title: string;

	@Transform(({ value }) => trim(value))
	@IsString({ message: "Author must be text!" })
	@IsNotEmpty({ message: "Author is required!" })
	@MaxLength(255, { message: "Author must be at most 255 characters!" })
	author: string;

	@Transform(({ value }) => trim(value))
	@IsString({ message: "Language must be text!" })
	@IsNotEmpty({ message: "Language is required!" })
	@MaxLength(35, { message: "Language must be at most 35 characters!" })
	language: string;

	@IsDefined({
		message: "Total pages is required; use null when there is no total!"
	})
	@ValidateIf((_object, value) => value !== null)
	@IsInt({ message: "Total pages must be a positive integer!" })
	@Min(1, { message: "Total pages must be a positive integer!" })
	total_pages: number | null;

	@IsDefined({
		message: "Cover file ID is required; use null when there is no cover!"
	})
	@ValidateIf((_object, value) => value !== null)
	@IsUUID("4", { message: "Cover file ID must be a valid UUID!" })
	cover_file_id: string | null;

	@IsUUID("4", { message: "Ebook file ID must be a valid UUID!" })
	ebook_file_id: string;

	@IsDefined({
		message: "Overview is required; use null when there is no overview!"
	})
	@ValidateIf((_object, value) => value !== null)
	@Transform(({ value }) => trim(value))
	@IsString({ message: "Overview must be text!" })
	overview: string | null;

	@IsArray({ message: "Tag IDs must be an array!" })
	@ArrayNotEmpty({ message: "At least one tag ID is required!" })
	@ArrayUnique({ message: "Tag IDs must not contain duplicates!" })
	@IsInt({ each: true, message: "Every tag ID must be a positive integer!" })
	@Min(1, {
		each: true,
		message: "Every tag ID must be a positive integer!"
	})
	tag_ids: number[];
}

export interface EbookFileResponse {
	id: string;
	file_name: string;
	content_type: string;
	size_bytes: number | null;
	url: string | null;
}

export interface EbookTagResponse {
	id: number;
	label: string;
}

export interface EbookUploaderResponse {
	id: string;
	name: string;
}

export interface CreatedEbookResponse {
	id: string;
	title: string;
	author: string;
	language: string;
	total_pages: number | null;
	overview: string | null;
	cover_file: EbookFileResponse | null;
	ebook_file: EbookFileResponse;
	tags: EbookTagResponse[];
	created_at: string;
	updated_at: string;
	uploaded_by: EbookUploaderResponse;
}

export interface CreateEbookResponse {
	data: CreatedEbookResponse;
}

export interface EbookListItemResponse {
	id: string;
	title: string;
	author: string;
	tags: EbookTagResponse[];
	uploaded_by: EbookUploaderResponse;
	created_at: string;
	updated_at: string;
}

export type EbooksListResponse = PaginatedResponse<EbookListItemResponse>;

export type EbookDetailDataResponse = CreatedEbookResponse;

export interface EbookDetailResponse {
	data: EbookDetailDataResponse;
}

export type UpdateEbookResponse = EbookDetailResponse;
