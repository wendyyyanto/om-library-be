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
import { EntityManager, Repository } from "typeorm";
import { ERROR_CODES } from "../constants/error-codes";
import { FileUploadResponse } from "../dtos/FileDto";
import { LibraryFileEntity } from "../entities/LibraryFileEntity";
import { TeachingEntity } from "../entities/TeachingEntity";
import { TransactionRunner } from "../utilities/TransactionRunner";

@Injectable()
export class FilesService {
	private static readonly ASSET_BASE_URL =
		"https://assets.organic-ministry.org";
	private readonly logger = new Logger(FilesService.name);
	private readonly bucket: string;
	private readonly r2: S3Client;

	constructor(
		config: ConfigService,
		@InjectRepository(LibraryFileEntity)
		private readonly files: Repository<LibraryFileEntity>,
		private readonly transactions: TransactionRunner
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
					url: this.assetUrl(key),
					contentType,
					sizeBytes: file.size
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
		let storageObjectDeleted = false;
		try {
			await this.transactions.run(async (manager) => {
				const files = manager.getRepository(LibraryFileEntity);
				const file = await files
					.createQueryBuilder("file")
					.select(["file.id", "file.uploadedBy", "file.storageKey"])
					.where("file.id = :fileId", { fileId })
					.setLock("pessimistic_write")
					.getOne();

				if (!file) throw this.fileNotFound();
				if (file.uploadedBy !== userId) throw this.forbidden();
				if (await this.isReferencedByTeaching(manager, file.id))
					throw this.fileInUse();

				await this.deleteStoredObject(file.storageKey);
				storageObjectDeleted = true;
				const result = await files.delete({ id: file.id, uploadedBy: userId });
				if (result.affected !== 1)
					throw new Error("The locked file row could not be deleted.");
			});
		} catch (error) {
			if (storageObjectDeleted)
				this.logger.error(
					`File ${fileId} needs reconciliation after its R2 object was deleted but its database transaction failed.`
				);
			throw error;
		}
	}

	async deleteStoredObject(
		storageKey: string,
		message = "The file could not be deleted. Please try again."
	): Promise<void> {
		try {
			await this.r2.send(
				new DeleteObjectCommand({ Bucket: this.bucket, Key: storageKey })
			);
		} catch (error) {
			this.logger.error(`R2 delete failed (${this.errorName(error)}).`);
			throw new BadGatewayException({
				statusCode: HttpStatus.BAD_GATEWAY,
				code: ERROR_CODES.FILE_DELETE_FAILED,
				message
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

	private assetUrl(storageKey: string): string {
		const encodedKey = storageKey
			.split("/")
			.map((segment) => encodeURIComponent(segment))
			.join("/");
		return `${FilesService.ASSET_BASE_URL}/${encodedKey}`;
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

	private fileInUse(): ConflictException {
		return new ConflictException({
			statusCode: HttpStatus.CONFLICT,
			code: ERROR_CODES.INVALID_STATE,
			message: "The file is still used by a teaching."
		});
	}

	private async isReferencedByTeaching(
		manager: EntityManager,
		fileId: string
	): Promise<boolean> {
		return manager
			.getRepository(TeachingEntity)
			.createQueryBuilder("teaching")
			.where(
				"(teaching.audioFileId = :fileId OR teaching.pdfFileId = :fileId OR teaching.pptFileId = :fileId)",
				{ fileId }
			)
			.getExists();
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
