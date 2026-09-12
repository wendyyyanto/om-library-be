import {
	BadRequestException,
	ConflictException,
	ForbiddenException,
	HttpStatus,
	Injectable,
	Logger,
	NotFoundException
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { randomUUID } from "node:crypto";
import { In, Repository } from "typeorm";
import { ERROR_CODES } from "../constants/error-codes";
import {
	CreatedTeachingResponse,
	CreateTeachingDto,
	CreateTeachingResponse,
	DEFAULT_TEACHINGS_LIMIT,
	DEFAULT_TEACHINGS_PAGE,
	GetTeachingsQueryDto,
	TEACHING_MEDIA_REQUIRED_MESSAGE,
	TeachingDetailDataResponse,
	TeachingDetailResponse,
	TeachingFileResponse,
	TeachingListItemResponse,
	TeachingsListResponse
} from "../dtos/TeachingDto";
import { LibraryFileEntity } from "../entities/LibraryFileEntity";
import { TeachingEntity } from "../entities/TeachingEntity";
import { TransactionRunner } from "../utilities/TransactionRunner";
import { FilesService } from "./FilesService";

@Injectable()
export class TeachingsService {
	private readonly logger = new Logger(TeachingsService.name);

	constructor(
		@InjectRepository(TeachingEntity)
		private readonly teachings: Repository<TeachingEntity>,
		private readonly filesService: FilesService,
		private readonly transactions: TransactionRunner
	) {}

	async create(
		userId: string,
		dto: CreateTeachingDto
	): Promise<CreateTeachingResponse> {
		if (!dto.audio_file_id && !dto.video_url)
			throw new BadRequestException({
				statusCode: HttpStatus.BAD_REQUEST,
				code: ERROR_CODES.VALIDATION_FAILED,
				message: TEACHING_MEDIA_REQUIRED_MESSAGE,
				errors: [TEACHING_MEDIA_REQUIRED_MESSAGE]
			});

		const id = randomUUID();
		await this.teachings.save(
			this.teachings.create({
				id,
				title: dto.title,
				passage: dto.passage,
				chapters: dto.chapters,
				category: dto.category,
				year: dto.year,
				teacher: dto.teacher,
				event: dto.event,
				audioFileId: dto.audio_file_id ?? null,
				videoUrl: dto.video_url ?? null,
				pdfFileId: dto.pdf_file_id ?? null,
				pptFileId: dto.ppt_file_id ?? null,
				uploadedBy: userId
			})
		);

		const teaching = await this.teachings.findOneByOrFail({ id });
		return { data: this.toCreatedResponse(teaching) };
	}

	async list(query: GetTeachingsQueryDto): Promise<TeachingsListResponse> {
		const page = query.page ?? DEFAULT_TEACHINGS_PAGE;
		const limit = query.limit ?? DEFAULT_TEACHINGS_LIMIT;

		const [teachings, totalItems] = await this.teachings.findAndCount({
			select: {
				id: true,
				title: true,
				category: true,
				teacher: true,
				createdAt: true,
				uploader: {
					id: true,
					name: true
				}
			},
			relations: { uploader: true },
			order: { createdAt: "DESC", id: "DESC" },
			skip: (page - 1) * limit,
			take: limit
		});

		return {
			data: teachings.map((teaching) => this.toResponse(teaching)),
			pagination: {
				page,
				limit,
				total_items: totalItems,
				total_pages: Math.ceil(totalItems / limit)
			}
		};
	}

	async getById(id: string): Promise<TeachingDetailResponse> {
		const teaching = await this.teachings
			.createQueryBuilder("teaching")
			.leftJoinAndSelect("teaching.audioFile", "audioFile")
			.leftJoinAndSelect("teaching.pdfFile", "pdfFile")
			.leftJoinAndSelect("teaching.pptFile", "pptFile")
			.leftJoinAndSelect("teaching.uploader", "uploader")
			.select([
				"teaching.id",
				"teaching.title",
				"teaching.passage",
				"teaching.chapters",
				"teaching.category",
				"teaching.year",
				"teaching.teacher",
				"teaching.event",
				"teaching.videoUrl",
				"teaching.createdAt",
				"teaching.updatedAt",
				"uploader.id",
				"uploader.name",
				"audioFile.id",
				"audioFile.fileName",
				"audioFile.contentType",
				"audioFile.sizeBytes",
				"audioFile.url",
				"pdfFile.id",
				"pdfFile.fileName",
				"pdfFile.contentType",
				"pdfFile.sizeBytes",
				"pdfFile.url",
				"pptFile.id",
				"pptFile.fileName",
				"pptFile.contentType",
				"pptFile.sizeBytes",
				"pptFile.url"
			])
			.where("teaching.id = :id", { id })
			.getOne();

		if (!teaching) throw this.teachingNotFound();

		return { data: this.toDetailResponse(teaching) };
	}

	async delete(userId: string, id: string): Promise<void> {
		const deletedStorageFileIds = new Set<string>();
		try {
			await this.transactions.run(async (manager) => {
				const teachings = manager.getRepository(TeachingEntity);
				const teaching = await teachings
					.createQueryBuilder("teaching")
					.select([
						"teaching.id",
						"teaching.uploadedBy",
						"teaching.audioFileId",
						"teaching.pdfFileId",
						"teaching.pptFileId"
					])
					.where("teaching.id = :id", { id })
					.setLock("pessimistic_write")
					.getOne();

				if (!teaching) throw this.teachingNotFound();
				if (teaching.uploadedBy !== userId) throw this.forbidden();

				const fileIds = [
					...new Set(
						[
							teaching.audioFileId,
							teaching.pdfFileId,
							teaching.pptFileId
						].filter((fileId): fileId is string => fileId !== null)
					)
				];

				if (fileIds.length > 0) {
					const files = await manager
						.getRepository(LibraryFileEntity)
						.createQueryBuilder("file")
						.select(["file.id", "file.uploadedBy", "file.storageKey"])
						.where("file.id IN (:...fileIds)", { fileIds })
						.setLock("pessimistic_write")
						.getMany();

					if (files.length !== fileIds.length)
						throw this.invalidFileState(
							"One or more teaching files no longer exist."
						);
					if (files.some((file) => file.uploadedBy !== userId))
						throw this.invalidFileState(
							"The teaching contains a file owned by another user."
						);
					if (await this.hasSharedFile(id, fileIds, teachings))
						throw this.invalidFileState(
							"The teaching contains a file that is still used by another teaching."
						);

					for (const file of files) {
						await this.filesService.deleteStoredObject(
							file.storageKey,
							"One or more teaching files could not be deleted. Please try again."
						);
						deletedStorageFileIds.add(file.id);
					}
				}

				const teachingResult = await teachings.delete({ id });
				if (teachingResult.affected !== 1)
					throw new Error("The locked teaching row could not be deleted.");

				if (fileIds.length > 0) {
					const fileResult = await manager
						.getRepository(LibraryFileEntity)
						.delete({ id: In(fileIds) });
					if (fileResult.affected !== fileIds.length)
						throw new Error(
							"Not all locked teaching file rows were deleted."
						);
				}
			});
		} catch (error) {
			if (deletedStorageFileIds.size > 0)
				this.logger.error(
					`Teaching ${id} needs reconciliation after R2 deletion of file ids ${[
						...deletedStorageFileIds
					].join(", ")} did not result in a committed database deletion.`
				);
			throw error;
		}
	}

	private async hasSharedFile(
		teachingId: string,
		fileIds: string[],
		teachings: Repository<TeachingEntity>
	): Promise<boolean> {
		return teachings
			.createQueryBuilder("teaching")
			.where("teaching.id <> :teachingId", { teachingId })
			.andWhere(
				"(teaching.audioFileId IN (:...fileIds) OR teaching.pdfFileId IN (:...fileIds) OR teaching.pptFileId IN (:...fileIds))",
				{ fileIds }
			)
			.getExists();
	}

	private toResponse(teaching: TeachingEntity): TeachingListItemResponse {
		return {
			id: teaching.id,
			title: teaching.title,
			category: teaching.category,
			teacher: teaching.teacher,
			date: teaching.createdAt.toISOString(),
			uploaded_by: {
				id: teaching.uploader.id,
				name: teaching.uploader.name
			}
		};
	}

	private toDetailResponse(
		teaching: TeachingEntity
	): TeachingDetailDataResponse {
		return {
			id: teaching.id,
			title: teaching.title,
			passage: teaching.passage,
			chapters: teaching.chapters,
			category: teaching.category,
			year: teaching.year,
			teacher: teaching.teacher,
			event: teaching.event,
			audio_file: this.toFileResponse(teaching.audioFile),
			video_url: teaching.videoUrl,
			pdf_file: this.toFileResponse(teaching.pdfFile),
			ppt_file: this.toFileResponse(teaching.pptFile),
			created_at: teaching.createdAt.toISOString(),
			updated_at: teaching.updatedAt.toISOString(),
			uploaded_by: {
				id: teaching.uploader.id,
				name: teaching.uploader.name
			}
		};
	}

	private toFileResponse(
		file: LibraryFileEntity | null
	): TeachingFileResponse | null {
		if (!file) return null;

		return {
			id: file.id,
			file_name: file.fileName,
			content_type: file.contentType,
			size_bytes: file.sizeBytes,
			url: file.url
		};
	}

	private toCreatedResponse(
		teaching: TeachingEntity
	): CreatedTeachingResponse {
		return {
			id: teaching.id,
			title: teaching.title,
			passage: teaching.passage,
			chapters: teaching.chapters,
			category: teaching.category,
			year: teaching.year,
			teacher: teaching.teacher,
			event: teaching.event,
			audio_file_id: teaching.audioFileId,
			video_url: teaching.videoUrl,
			pdf_file_id: teaching.pdfFileId,
			ppt_file_id: teaching.pptFileId,
			created_at: teaching.createdAt.toISOString(),
			updated_at: teaching.updatedAt.toISOString(),
			uploaded_by: teaching.uploadedBy
		};
	}

	private teachingNotFound(): NotFoundException {
		return new NotFoundException({
			statusCode: HttpStatus.NOT_FOUND,
			code: ERROR_CODES.NOT_FOUND,
			message: "Teaching not found."
		});
	}

	private forbidden(): ForbiddenException {
		return new ForbiddenException({
			statusCode: HttpStatus.FORBIDDEN,
			code: ERROR_CODES.FORBIDDEN,
			message: "You do not have permission to delete this teaching."
		});
	}

	private invalidFileState(message: string): ConflictException {
		return new ConflictException({
			statusCode: HttpStatus.CONFLICT,
			code: ERROR_CODES.INVALID_STATE,
			message
		});
	}
}
