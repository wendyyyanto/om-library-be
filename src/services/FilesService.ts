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
	HeadObjectCommand,
	PutObjectCommand,
	S3Client
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { JwtService } from "@nestjs/jwt";
import { InjectRepository } from "@nestjs/typeorm";
import { randomUUID } from "node:crypto";
import { EntityManager, Repository } from "typeorm";
import { ERROR_CODES } from "../constants/error-codes";
import {
	CreateUploadUrlDto,
	FileUploadResponse,
	LegacyFileUploadResponse,
	UploadUrlResponse
} from "../dtos/FileDto";
import { ClassMaterialEntity } from "../entities/ClassMaterialEntity";
import { EbookEntity } from "../entities/EbookEntity";
import { LibraryFileEntity } from "../entities/LibraryFileEntity";
import { NotificationEntity } from "../entities/NotificationEntity";
import { TeachingEntity } from "../entities/TeachingEntity";
import { TransactionRunner } from "../utilities/TransactionRunner";

const DEFAULT_FILE_UPLOAD_MAX_BYTES = 1024 * 1024 * 1024;
const UPLOAD_URL_TTL_SECONDS = 15 * 60;
const UPLOAD_TOKEN_TTL = "24h";
const UPLOAD_TOKEN_PURPOSE = "file-upload";

/** Signed with JWT_SECRET but has no `sub`/`role`/`sid`, so JwtAuthGuard rejects it as a bearer token. */
interface UploadTokenPayload {
	purpose: typeof UPLOAD_TOKEN_PURPOSE;
	uid: string;
	key: string;
	fileName: string;
	contentType: string;
	size: number;
}

export function fileUploadMaxBytes(config: ConfigService): number {
	const raw = config.get<string>("FILE_UPLOAD_MAX_BYTES");
	if (raw === undefined) return DEFAULT_FILE_UPLOAD_MAX_BYTES;

	const value = Number(raw);
	if (!Number.isSafeInteger(value) || value <= 0)
		throw new Error(
			"FILE_UPLOAD_MAX_BYTES must be a positive whole number of bytes"
		);
	return value;
}

@Injectable()
export class FilesService {
	private static readonly ASSET_BASE_URL =
		"https://assets.organic-ministry.org";
	private readonly logger = new Logger(FilesService.name);
	private readonly bucket: string;
	private readonly maxBytes: number;
	private readonly r2: S3Client;

	constructor(
		config: ConfigService,
		@InjectRepository(LibraryFileEntity)
		private readonly files: Repository<LibraryFileEntity>,
		private readonly transactions: TransactionRunner,
		private readonly jwt: JwtService
	) {
		const accountId = this.requiredConfig(config, "CLOUDFLARE_ACCOUNT_ID");
		const accessKeyId = this.requiredConfig(config, "R2_ACCESS_KEY_ID");
		const secretAccessKey = this.requiredConfig(
			config,
			"R2_SECRET_ACCESS_KEY"
		);
		this.bucket = this.requiredConfig(config, "R2_BUCKET_NAME");
		this.maxBytes = fileUploadMaxBytes(config);

		this.r2 = new S3Client({
			region: "auto",
			endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
			credentials: { accessKeyId, secretAccessKey },
			// The default CRC32 checksum would be baked into presigned URLs for an empty body.
			requestChecksumCalculation: "WHEN_REQUIRED"
		});
	}

	async upload(
		userId: string,
		file: Express.Multer.File | undefined,
		path: string
	): Promise<LegacyFileUploadResponse> {
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
			await this.recordFile(fileId, userId, {
				key,
				fileName: file.originalname,
				contentType,
				size: file.size
			});
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

	/** Step 1 of a direct upload: the client PUTs the bytes to `upload_url`, then calls {@link completeUpload}. */
	async createUploadUrl(
		userId: string,
		dto: CreateUploadUrlDto
	): Promise<UploadUrlResponse> {
		if (dto.size > this.maxBytes)
			throw this.invalidFile(`File must be at most ${this.maxBytes} bytes.`);

		const key = this.storageKey(dto.path || "files", dto.file_name);
		const contentType = dto.content_type || "application/octet-stream";
		if (await this.files.existsBy({ storageKey: key }))
			throw this.fileAlreadyExists();

		// Content-Length and Content-Type are signed, so R2 rejects a PUT with any other size or type.
		const uploadUrl = await getSignedUrl(
			this.r2,
			new PutObjectCommand({
				Bucket: this.bucket,
				Key: key,
				ContentLength: dto.size,
				ContentType: contentType,
				IfNoneMatch: "*"
			}),
			{
				expiresIn: UPLOAD_URL_TTL_SECONDS,
				signableHeaders: new Set(["content-type"])
			}
		);
		const payload: UploadTokenPayload = {
			purpose: UPLOAD_TOKEN_PURPOSE,
			uid: userId,
			key,
			fileName: dto.file_name,
			contentType,
			size: dto.size
		};
		const uploadToken = await this.jwt.signAsync(payload, {
			expiresIn: UPLOAD_TOKEN_TTL
		});

		return {
			upload_url: uploadUrl,
			headers: { "Content-Type": contentType, "If-None-Match": "*" },
			upload_token: uploadToken,
			expires_in: UPLOAD_URL_TTL_SECONDS
		};
	}

	/** Step 2 of a direct upload: confirms the object landed in R2 and registers it. */
	async completeUpload(
		userId: string,
		uploadToken: string
	): Promise<FileUploadResponse> {
		const upload = await this.verifyUploadToken(userId, uploadToken);
		if (await this.files.existsBy({ storageKey: upload.key }))
			throw this.fileAlreadyExists();

		let size: number | undefined;
		try {
			const head = await this.r2.send(
				new HeadObjectCommand({ Bucket: this.bucket, Key: upload.key })
			);
			size = head.ContentLength;
		} catch (error) {
			if (this.hasStatus(error, HttpStatus.NOT_FOUND))
				throw this.invalidFile("The file has not been uploaded yet.");
			this.logger.error(`R2 head failed (${this.errorName(error)}).`);
			throw new BadGatewayException({
				statusCode: HttpStatus.BAD_GATEWAY,
				code: ERROR_CODES.FILE_UPLOAD_FAILED,
				message: "The upload could not be verified. Please try again."
			});
		}
		if (size !== upload.size)
			throw this.invalidFile("The uploaded file does not match the requested size.");

		// No R2 cleanup on failure: the object is the caller's and a retry can still register it.
		const fileId = randomUUID();
		await this.recordFile(fileId, userId, upload);
		return {
			file_id: fileId,
			file_name: upload.fileName,
			size: upload.size,
			content_type: upload.contentType
		};
	}

	async delete(userId: string, fileId: string): Promise<void> {
		await this.deleteFile(userId, fileId, false);
	}

	async deleteIfUnreferenced(
		userId: string,
		fileId: string
	): Promise<boolean> {
		return this.deleteFile(userId, fileId, true);
	}

	private async deleteFile(
		userId: string,
		fileId: string,
		skipUnavailable: boolean
	): Promise<boolean> {
		let storageObjectDeleted = false;
		try {
			return await this.transactions.run(async (manager) => {
				const files = manager.getRepository(LibraryFileEntity);
				const file = await files
					.createQueryBuilder("file")
					.select(["file.id", "file.uploadedBy", "file.storageKey"])
					.where("file.id = :fileId", { fileId })
					.setLock("pessimistic_write")
					.getOne();

				if (!file) {
					if (skipUnavailable) return false;
					throw this.fileNotFound();
				}
				if (file.uploadedBy !== userId) {
					if (skipUnavailable) return false;
					throw this.forbidden();
				}
				if (await this.isReferenced(manager, file.id)) {
					if (skipUnavailable) return false;
					throw this.fileInUse();
				}

				await this.deleteStoredObject(file.storageKey);
				storageObjectDeleted = true;
				const result = await files.delete({ id: file.id, uploadedBy: userId });
				if (result.affected !== 1)
					throw new Error("The locked file row could not be deleted.");
				return true;
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

	private async recordFile(
		fileId: string,
		userId: string,
		file: { key: string; fileName: string; contentType: string; size: number }
	): Promise<void> {
		await this.files.save(
			this.files.create({
				id: fileId,
				uploadedBy: userId,
				storageKey: file.key,
				fileName: file.fileName,
				url: this.assetUrl(file.key),
				contentType: file.contentType,
				sizeBytes: file.size
			})
		);
	}

	private async verifyUploadToken(
		userId: string,
		token: string
	): Promise<UploadTokenPayload> {
		const invalid = this.invalidFile("Upload token is invalid or expired.");
		let payload: UploadTokenPayload;
		try {
			payload = await this.jwt.verifyAsync<UploadTokenPayload>(token);
		} catch {
			throw invalid;
		}
		if (payload.purpose !== UPLOAD_TOKEN_PURPOSE || payload.uid !== userId)
			throw invalid;
		return payload;
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
			message: "The file is still in use."
		});
	}

	private async isReferenced(
		manager: EntityManager,
		fileId: string
	): Promise<boolean> {
		const teachingReference = await manager
			.getRepository(TeachingEntity)
			.createQueryBuilder("teaching")
			.where(
				"(teaching.audioFileId = :fileId OR teaching.pdfFileId = :fileId OR teaching.pptFileId = :fileId)",
				{ fileId }
			)
			.getExists();
		if (teachingReference) return true;

		const notificationReference = await manager
			.getRepository(NotificationEntity)
			.existsBy({ thumbnailFileId: fileId });
		if (notificationReference) return true;

		const ebookReference = await manager
			.getRepository(EbookEntity)
			.createQueryBuilder("ebook")
			.where(
				"ebook.coverFileId = :fileId OR ebook.ebookFileId = :fileId",
				{ fileId }
			)
			.getExists();
		if (ebookReference) return true;

		return manager
			.getRepository(ClassMaterialEntity)
			.existsBy({ fileId });
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
		return (
			(error as { name?: string } | null)?.name === "PreconditionFailed" ||
			this.hasStatus(error, HttpStatus.PRECONDITION_FAILED)
		);
	}

	private hasStatus(error: unknown, status: number): boolean {
		if (typeof error !== "object" || error === null) return false;
		return (
			(error as { $metadata?: { httpStatusCode?: number } }).$metadata
				?.httpStatusCode === status
		);
	}
}
