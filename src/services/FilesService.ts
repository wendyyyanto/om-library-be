import {
	BadGatewayException,
	BadRequestException,
	HttpStatus,
	Injectable,
	Logger
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";
import { extname } from "node:path";
import { ERROR_CODES } from "../constants/error-codes";
import { FileUploadResponse } from "../dtos/FileDto";

@Injectable()
export class FilesService {
	private readonly logger = new Logger(FilesService.name);
	private readonly bucket: string;
	private readonly r2: S3Client;

	constructor(config: ConfigService) {
		const accountId = this.requiredConfig(config, "CLOUDFLARE_ACCOUNT_ID");
		const accessKeyId = this.requiredConfig(config, "R2_ACCESS_KEY_ID");
		const secretAccessKey = this.requiredConfig(
			config,
			"R2_SECRET_ACCESS_KEY"
		);
		this.bucket = this.requiredConfig(config, "R2_BUCKET_NAME");

		this.r2 = new S3Client({
			region: "auto",
			endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
			credentials: { accessKeyId, secretAccessKey }
		});
	}

	async upload(
		userId: string,
		file: Express.Multer.File | undefined,
		path: string
	): Promise<FileUploadResponse> {
		if (!file)
			throw this.invalidFile("A file is required in the 'file' field.");
		if (!file.size)
			throw this.invalidFile("The uploaded file must not be empty.");

		const key = `${path}/${file.originalname}`;

		try {
			const result = await this.r2.send(
				new PutObjectCommand({
					Bucket: this.bucket,
					Key: key,
					Body: file.buffer,
					ContentLength: file.size,
					ContentType: file.mimetype || "application/octet-stream"
				})
			);

			return {
				key,
				etag: result.ETag?.replaceAll('"', "") ?? null,
				size: file.size,
				contentType: file.mimetype || "application/octet-stream",
				originalName: file.originalname
			};
		} catch (error) {
			this.logger.error(`R2 upload failed (${this.errorName(error)}).`);
			throw new BadGatewayException({
				statusCode: HttpStatus.BAD_GATEWAY,
				code: ERROR_CODES.FILE_UPLOAD_FAILED,
				message: "The file could not be stored. Please try again."
			});
		}
	}

	private requiredConfig(config: ConfigService, name: string): string {
		const value = config.get<string>(name)?.trim();
		if (!value)
			throw new Error(
				`${name} is not set — refusing to start without complete R2 configuration`
			);
		return value;
	}

	private invalidFile(message: string): BadRequestException {
		return new BadRequestException({
			statusCode: HttpStatus.BAD_REQUEST,
			code: ERROR_CODES.VALIDATION_FAILED,
			message
		});
	}

	private errorName(error: unknown): string {
		return error instanceof Error ? error.name : "unknown error";
	}
}
