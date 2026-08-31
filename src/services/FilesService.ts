import {
	BadGatewayException,
	BadRequestException,
	ConflictException,
	ForbiddenException,
	HttpStatus,
	Injectable,
	Logger,
	NotFoundException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
	DeleteObjectCommand,
	PutObjectCommand,
	S3Client
} from "@aws-sdk/client-s3";
import { InjectRepository } from "@nestjs/typeorm";
import { randomUUID } from "node:crypto";
import { IsNull, Repository } from "typeorm";
import { ERROR_CODES } from "../constants/error-codes";
import { FileUploadResponse } from "../dtos/FileDto";
import { LibraryFileEntity } from "../entities/LibraryFileEntity";

@Injectable()
export class FilesService {
	private readonly logger = new Logger(FilesService.name);
	private readonly bucket: string;
	private readonly r2: S3Client;

	constructor(
		config: ConfigService,
		@InjectRepository(LibraryFileEntity)
		private readonly files: Repository<LibraryFileEntity>
	) {
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

		const fileId = randomUUID();
		const key = this.storageKey(path, file.originalname);
		const contentType = file.mimetype || "application/octet-stream";
		if (await this.files.existsBy({ storageKey: key }))
			throw this.fileAlreadyExists();

		try {
			await this.r2.send(
				new PutObjectCommand({
					Bucket: this.bucket,
					Key: key,
					Body: file.buffer,
					ContentLength: file.size,
					ContentType: contentType,
					IfNoneMatch: "*"
				})
			);
		} catch (error) {
			if (this.isPreconditionFailed(error))
				throw this.fileAlreadyExists();
			this.logger.error(`R2 upload failed (${this.errorName(error)}).`);
			throw new BadGatewayException({
				statusCode: HttpStatus.BAD_GATEWAY,
				code: ERROR_CODES.FILE_UPLOAD_FAILED,
				message: "The file could not be stored. Please try again."
			});
		}

		try {
			await this.files.save(
				this.files.create({
					id: fileId,
					uploadedBy: userId,
					storageKey: key,
					fileName: file.originalname,
					contentType,
					sizeBytes: file.size,
					deletedAt: null
				})
			);
		} catch (error) {
			await this.removeOrphanedUpload(key, fileId);
			throw error;
		}

		return {
			fileId,
			fileName: file.originalname,
			size: file.size,
			contentType
		};
	}

	async delete(userId: string, fileId: string): Promise<void> {
		const file = await this.files.findOne({
			where: { id: fileId },
			select: {
				id: true,
				uploadedBy: true,
				storageKey: true,
				deletedAt: true
			}
		});
		if (!file) throw this.fileNotFound();
		if (file.uploadedBy !== userId) throw this.forbidden();
		if (file.deletedAt) return;

		try {
			await this.r2.send(
				new DeleteObjectCommand({
					Bucket: this.bucket,
					Key: file.storageKey
				})
			);
		} catch (error) {
			this.logger.error(`R2 delete failed (${this.errorName(error)}).`);
			throw new BadGatewayException({
				statusCode: HttpStatus.BAD_GATEWAY,
				code: ERROR_CODES.FILE_DELETE_FAILED,
				message: "The file could not be deleted. Please try again."
			});
		}

		await this.files.update(
			{ id: file.id, uploadedBy: userId, deletedAt: IsNull() },
			{ deletedAt: new Date() }
		);
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

	private storageKey(path: string, fileName: string): string {
		if (
			!fileName.trim().length ||
			fileName.length > 255 ||
			fileName === "." ||
			fileName === ".." ||
			/[\u0000-\u001f\u007f/\\]/u.test(fileName)
		)
			throw this.invalidFile(
				"File name must be a valid single name of at most 255 characters."
			);

		const rawPath = path.trim();
		if (/[\u0000-\u001f\u007f\\]/u.test(rawPath))
			throw this.invalidFile(
				"Path must not contain control characters or backslashes."
			);

		const segments = rawPath
			.split("/")
			.filter((segment) => segment.length > 0)
			.map((segment) => segment.trim());
		if (
			segments.some(
				(segment) =>
					!segment.length || segment === "." || segment === ".."
			)
		)
			throw this.invalidFile(
				"Path must not contain blank, '.' or '..' segments."
			);

		const prefix = segments.join("/");
		const key = prefix ? `${prefix}/${fileName}` : fileName;
		if (Buffer.byteLength(key, "utf8") > 1024)
			throw this.invalidFile(
				"Path and file name are too long for an R2 object key."
			);
		return key;
	}

	private fileAlreadyExists(): ConflictException {
		return new ConflictException({
			statusCode: HttpStatus.CONFLICT,
			code: ERROR_CODES.FILE_ALREADY_EXISTS,
			message: "A file with this name already exists in this path."
		});
	}

	private fileNotFound(): NotFoundException {
		return new NotFoundException({
			statusCode: HttpStatus.NOT_FOUND,
			code: ERROR_CODES.NOT_FOUND,
			message: "File not found."
		});
	}

	private forbidden(): ForbiddenException {
		return new ForbiddenException({
			statusCode: HttpStatus.FORBIDDEN,
			code: ERROR_CODES.FORBIDDEN,
			message: "You do not have permission to delete this file."
		});
	}

	private async removeOrphanedUpload(
		key: string,
		fileId: string
	): Promise<void> {
		try {
			await this.r2.send(
				new DeleteObjectCommand({ Bucket: this.bucket, Key: key })
			);
		} catch (error) {
			this.logger.error(
				`R2 cleanup failed for file ${fileId} (${this.errorName(error)}).`
			);
		}
	}

	private errorName(error: unknown): string {
		return error instanceof Error ? error.name : "unknown error";
	}

	private isPreconditionFailed(error: unknown): boolean {
		if (typeof error !== "object" || error === null) return false;
		const r2Error = error as {
			name?: string;
			$metadata?: { httpStatusCode?: number };
		};
		return (
			r2Error.name === "PreconditionFailed" ||
			r2Error.$metadata?.httpStatusCode === HttpStatus.PRECONDITION_FAILED
		);
	}
}
