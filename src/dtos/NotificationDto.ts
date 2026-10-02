import { Transform } from "class-transformer";
import {
	IsInt,
	IsISO8601,
	IsNotEmpty,
	IsOptional,
	IsString,
	IsUUID,
	MaxLength,
	Min
} from "class-validator";
import { GetPaginationQueryDto } from "./PaginationDto";

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

export class GetNotificationsQueryDto extends GetPaginationQueryDto {
	@IsOptional()
	@Transform(({ value }) => toNumber(value))
	@IsInt({ message: "Segment ID must be a positive integer!" })
	@Min(1, { message: "Segment ID must be a positive integer!" })
	segment_id?: number;

	@IsOptional()
	@Transform(({ value }) => trimOptional(value))
	@IsString({ message: "Search keyword must be text!" })
	@MaxLength(255, {
		message: "Search keyword must be at most 255 characters!"
	})
	q?: string;
}

export class GetNotificationParamsDto {
	@IsUUID(undefined, { message: "Notification ID must be a valid UUID!" })
	id: string;
}

export class CreateNotificationDto {
	@IsInt({ message: "Segment ID must be a positive integer!" })
	@Min(1, { message: "Segment ID must be a positive integer!" })
	segment_id: number;

	@Transform(({ value }) => trim(value))
	@IsString({ message: "Title must be text!" })
	@IsNotEmpty({ message: "Title is required!" })
	@MaxLength(255, { message: "Title must be at most 255 characters!" })
	title: string;

	@Transform(({ value }) => trim(value))
	@IsString({ message: "Description must be text!" })
	@IsNotEmpty({ message: "Description is required!" })
	@MaxLength(65535, {
		message: "Description must be at most 65535 characters!"
	})
	description: string;

	@IsOptional()
	@Transform(({ value }) => trimOptional(value))
	@IsUUID("4", { message: "Thumbnail file ID must be a valid UUID!" })
	thumbnail_file_id?: string | null;

	@IsISO8601(
		{ strict: true },
		{ message: "Event date must be a valid ISO 8601 date!" }
	)
	event_date: string;
}

export interface NotificationSegmentResponse {
	id: number;
	name: string;
}

export interface NotificationThumbnailResponse {
	id: string;
	url: string | null;
}

export interface NotificationResponse {
	id: string;
	title: string;
	description: string;
	event_date: string;
	segment: NotificationSegmentResponse;
	thumbnail: NotificationThumbnailResponse | null;
	onesignal_id: string | null;
	created_at: string;
	updated_at: string;
}

export interface NotificationDetailResponse {
	data: NotificationResponse;
}
