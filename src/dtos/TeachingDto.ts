import { Transform } from "class-transformer";
import {
	IsEnum,
	IsOptional,
	IsUrl,
	ValidateBy,
	ValidationArguments,
	ValidationOptions
} from "class-validator";
import { TeachingCategory } from "../entities/TeachingEntity";

export const DEFAULT_TEACHINGS_PAGE = 1;
export const DEFAULT_TEACHINGS_LIMIT = 10;
export const MAX_TEACHINGS_LIMIT = 50;

function toNumber(value: unknown): unknown {
	return typeof value === "string" ? Number(value) : value;
}

function trim(value: unknown): unknown {
	return typeof value === "string" ? value.trim() : value;
}

function trimOptional(value: unknown): unknown {
	const trimmed = trim(value);
	return trimmed === "" ? undefined : trimmed;
}

function IsRequiredString(
	field: string,
	maximumLength: number
): PropertyDecorator {
	return ValidateBy({
		name: "isRequiredString",
		constraints: [field, maximumLength],
		validator: {
			validate(value: unknown): boolean {
				return (
					typeof value === "string" &&
					value.length > 0 &&
					value.length <= maximumLength
				);
			},
			defaultMessage(args: ValidationArguments): string {
				if (
					args.value === undefined ||
					args.value === null ||
					args.value === ""
				)
					return `${field} is required!`;
				if (typeof args.value !== "string") return `${field} must be text!`;
				return `${field} must be at most ${maximumLength} characters!`;
			}
		}
	});
}

function IsIntegerInRange(
	minimum: number,
	maximum?: number,
	validationOptions?: ValidationOptions
): PropertyDecorator {
	return ValidateBy(
		{
			name: "isIntegerInRange",
			constraints: [minimum, maximum],
			validator: {
				validate(value: unknown): boolean {
					return (
						typeof value === "number" &&
						Number.isInteger(value) &&
						value >= minimum &&
						(maximum === undefined || value <= maximum)
					);
				}
			}
		},
		validationOptions
	);
}

export class GetTeachingsQueryDto {
	@IsOptional()
	@Transform(({ value }) => toNumber(value))
	@IsIntegerInRange(1, undefined, {
		message: "Page must be a positive integer!"
	})
	page?: number;

	@IsOptional()
	@Transform(({ value }) => toNumber(value))
	@IsIntegerInRange(1, MAX_TEACHINGS_LIMIT, {
		message: "Limit must be an integer from 1 to 50!"
	})
	limit?: number;
}

const CATEGORY_MESSAGE =
	"Category must be New Testament, Old Testament, Topical Teaching, or Workshop!";
export const TEACHING_MEDIA_REQUIRED_MESSAGE =
	"At least one of audio_url or video_url is required!";

export class CreateTeachingDto {
	@Transform(({ value }) => trim(value))
	@IsRequiredString("Title", 255)
	title: string;

	@Transform(({ value }) => trim(value))
	@IsRequiredString("Passage", 255)
	passage: string;

	@Transform(({ value }) => trim(value))
	@IsRequiredString("Chapters", 255)
	chapters: string;

	@Transform(({ value }) => trim(value))
	@IsEnum(TeachingCategory, { message: CATEGORY_MESSAGE })
	category: TeachingCategory;

	@Transform(({ value }) => trim(value))
	@IsRequiredString("Year", 32)
	year: string;

	@Transform(({ value }) => trim(value))
	@IsRequiredString("Teacher", 255)
	teacher: string;

	@Transform(({ value }) => trim(value))
	@IsRequiredString("Event", 255)
	event: string;

	@IsOptional()
	@Transform(({ value }) => trimOptional(value))
	@IsUrl(
		{ protocols: ["http", "https"], require_protocol: true, require_tld: false },
		{ message: "Audio URL must be a valid HTTP or HTTPS URL!" }
	)
	audio_url?: string | null;

	@IsOptional()
	@Transform(({ value }) => trimOptional(value))
	@IsUrl(
		{ protocols: ["http", "https"], require_protocol: true, require_tld: false },
		{ message: "Video URL must be a valid HTTP or HTTPS URL!" }
	)
	video_url?: string | null;

	@IsOptional()
	@Transform(({ value }) => trimOptional(value))
	@IsUrl(
		{ protocols: ["http", "https"], require_protocol: true, require_tld: false },
		{ message: "PDF URL must be a valid HTTP or HTTPS URL!" }
	)
	pdf_url?: string | null;

	@IsOptional()
	@Transform(({ value }) => trimOptional(value))
	@IsUrl(
		{ protocols: ["http", "https"], require_protocol: true, require_tld: false },
		{ message: "PPT URL must be a valid HTTP or HTTPS URL!" }
	)
	ppt_url?: string | null;
}

export interface TeachingListItemResponse {
	id: string;
	title: string;
	category: TeachingCategory;
	teacher: string;
	date: string;
	uploaded_by: string;
}

export interface TeachingsPaginationResponse {
	page: number;
	limit: number;
	total_items: number;
	total_pages: number;
}

export interface TeachingsListResponse {
	data: TeachingListItemResponse[];
	pagination: TeachingsPaginationResponse;
}

export interface CreatedTeachingResponse {
	id: string;
	title: string;
	passage: string;
	chapters: string;
	category: TeachingCategory;
	year: string;
	teacher: string;
	event: string;
	audio_url: string | null;
	video_url: string | null;
	pdf_url: string | null;
	ppt_url: string | null;
	created_at: string;
	updated_at: string;
	uploaded_by: string;
}

export interface CreateTeachingResponse {
	data: CreatedTeachingResponse;
}
