import { Transform } from "class-transformer";
import {
	IsDefined,
	IsOptional,
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
	fileId: string;
	fileName: string;
	size: number;
	contentType: string;
}
