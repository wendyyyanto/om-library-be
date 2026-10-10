import { Transform } from "class-transformer";
import {
	IsDefined,
	IsInt,
	IsOptional,
	IsPositive,
	IsString,
	IsUUID,
	MaxLength
} from "class-validator";

export class UploadFileDto {
	@IsOptional()
	@IsString({ message: "Path must be text!" })
	@MaxLength(987, { message: "Path is too long!" })
	@Transform(({ value }) =>
		typeof value === "string" ? value.trim() : value
	)
	path?: string;
}

export class DeleteFileDto {
	@IsDefined({ message: "File ID is required!" })
	@IsUUID("4", { message: "File ID must be a valid UUID!" })
	file_id: string;
}

export interface FileUploadResponse {
	file_id: string;
	file_name: string;
	size: number;
	content_type: string;
}

/** `POST /v1/files` keeps camelCase for clients that have not moved to direct upload yet. */
export interface LegacyFileUploadResponse {
	fileId: string;
	fileName: string;
	size: number;
	contentType: string;
}

export class CreateUploadUrlDto extends UploadFileDto {
	@IsDefined({ message: "File name is required!" })
	@IsString({ message: "File name must be text!" })
	file_name: string;

	@IsOptional()
	@IsString({ message: "Content type must be text!" })
	@MaxLength(255, { message: "Content type is too long!" })
	content_type?: string;

	@IsDefined({ message: "File size is required!" })
	@IsInt({ message: "File size must be a whole number of bytes!" })
	@IsPositive({ message: "The file must not be empty." })
	size: number;
}

export class CompleteUploadDto {
	@IsDefined({ message: "Upload token is required!" })
	@IsString({ message: "Upload token must be text!" })
	upload_token: string;
}

export interface UploadUrlResponse {
	upload_url: string;
	/** Headers the client must send with the PUT; they are part of the signature. */
	headers: Record<string, string>;
	upload_token: string;
	expires_in: number;
}
