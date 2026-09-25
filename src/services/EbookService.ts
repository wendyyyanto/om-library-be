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
	CreateEbookDto,
	CreateEbookResponse,
	CreatedEbookResponse,
	EbookDetailResponse,
	EbookFileResponse,
	EbookListItemResponse,
	EbooksListResponse,
	EbookTagResponse,
	GetEbooksQueryDto,
	UpdateEbookDto,
	UpdateEbookResponse
} from "../dtos/EbookDto";
import { DEFAULT_LIMIT, DEFAULT_PAGE } from "../dtos/PaginationDto";
import { EbookEntity } from "../entities/EbookEntity";
import { EbookTagEntity } from "../entities/EbookTagEntity";
import { EbookTagLinkEntity } from "../entities/EbookTagLinkEntity";
import { LibraryFileEntity } from "../entities/LibraryFileEntity";
import { escapeLike } from "../utilities/escapeLike";
import { TransactionRunner } from "../utilities/TransactionRunner";
import { FilesService } from "./FilesService";

const COVER_CONTENT_TYPES = new Set([
	"image/jpeg",
	"image/png",
	"image/webp"
]);
const EBOOK_CONTENT_TYPES = new Set([
	"application/pdf",
	"application/epub+zip"
]);

@Injectable()
export class EbookService {
	private readonly logger = new Logger(EbookService.name);

	constructor(
		@InjectRepository(EbookEntity)
		private readonly ebooks: Repository<EbookEntity>,
		@InjectRepository(EbookTagLinkEntity)
		private readonly tagLinks: Repository<EbookTagLinkEntity>,
		private readonly filesService: FilesService,
		private readonly transactions: TransactionRunner
	) {}

	async create(
		userId: string,
		dto: CreateEbookDto
	): Promise<CreateEbookResponse> {
		const ebookId = await this.transactions.run(async (manager) => {
			const files = manager.getRepository(LibraryFileEntity);
			const fileIds = [
				dto.ebook_file_id,
				...(dto.cover_file_id ? [dto.cover_file_id] : [])
			];
			const uniqueFileIds = [...new Set(fileIds)];
			const attachedFiles = await files
				.createQueryBuilder("file")
				.where("file.id IN (:...fileIds)", { fileIds: uniqueFileIds })
				.orderBy("file.id", "ASC")
				.setLock("pessimistic_read")
				.getMany();

			if (attachedFiles.length !== uniqueFileIds.length)
				throw this.invalidReference("One or more ebook files do not exist.");
			if (attachedFiles.some((file) => file.uploadedBy !== userId))
				throw this.invalidFileState(
					"One or more ebook files belong to another user."
				);

			const fileById = new Map(attachedFiles.map((file) => [file.id, file]));
			const ebookFile = fileById.get(dto.ebook_file_id);
			if (!ebookFile || !EBOOK_CONTENT_TYPES.has(ebookFile.contentType))
				throw this.invalidContentType(
					"Ebook file must be a PDF or EPUB document."
				);

			if (dto.cover_file_id) {
				const coverFile = fileById.get(dto.cover_file_id);
				if (!coverFile || !COVER_CONTENT_TYPES.has(coverFile.contentType))
					throw this.invalidContentType(
						"Cover file must be a JPEG, PNG, or WebP image."
					);
			}

			const tags = await manager.getRepository(EbookTagEntity).findBy({
				id: In(dto.tag_ids)
			});
			if (tags.length !== dto.tag_ids.length)
				throw this.invalidReference("One or more ebook tags do not exist.");

			const id = randomUUID();
			await manager.getRepository(EbookEntity).insert({
				id,
				title: dto.title,
				author: dto.author,
				language: dto.language,
				totalPages: dto.total_pages ?? null,
				coverFileId: dto.cover_file_id ?? null,
				ebookFileId: dto.ebook_file_id,
				overview: dto.overview ?? null,
				uploadedBy: userId
			});

			await manager.getRepository(EbookTagLinkEntity).insert(
				dto.tag_ids.map((tagId) => ({ ebookId: id, tagId }))
			);

			return id;
		});

		return { data: await this.getDetailData(ebookId) };
	}

	async list(query: GetEbooksQueryDto): Promise<EbooksListResponse> {
		const page = query.page ?? DEFAULT_PAGE;
		const limit = query.limit ?? DEFAULT_LIMIT;
		const builder = this.ebooks
			.createQueryBuilder("ebook")
			.leftJoin("ebook.coverFile", "coverFile")
			.innerJoin("ebook.uploader", "uploader")
			.select([
				"ebook.id",
				"ebook.title",
				"ebook.author",
				"ebook.createdAt",
				"ebook.updatedAt",
				"coverFile.id",
				"coverFile.url",
				"uploader.id",
				"uploader.name"
			]);

		// Every keyword must appear in the title or one of the ebook's tags, so
		// "grace devotional" matches "Amazing Grace" tagged "Devotional".
		const keywords =
			query.q?.split(/\s+/).filter(Boolean).slice(0, 10) ?? [];
		keywords.forEach((keyword, index) => {
			const param = `keyword${index}`;
			builder.andWhere(
				`(ebook.title LIKE :${param} OR EXISTS (
					SELECT 1 FROM ebook_tag_links link
					INNER JOIN ebook_tags tag ON tag.id = link.tag_id
					WHERE link.ebook_id = ebook.id AND tag.label LIKE :${param}
				))`,
				{ [param]: `%${escapeLike(keyword)}%` }
			);
		});

		const [ebooks, totalItems] = await builder
			.orderBy("ebook.createdAt", "DESC")
			.addOrderBy("ebook.id", "DESC")
			.skip((page - 1) * limit)
			.take(limit)
			.getManyAndCount();

		const tagsByEbook = await this.getTagsByEbook(
			ebooks.map((ebook) => ebook.id)
		);

		return {
			data: ebooks.map((ebook) =>
				this.toListResponse(ebook, tagsByEbook.get(ebook.id) ?? [])
			),
			pagination: {
				page,
				limit,
				total_items: totalItems,
				total_pages: Math.ceil(totalItems / limit)
			}
		};
	}

	async getById(id: string): Promise<EbookDetailResponse> {
		return { data: await this.getDetailData(id) };
	}

	async update(
		userId: string,
		id: string,
		dto: UpdateEbookDto
	): Promise<UpdateEbookResponse> {
		await this.transactions.run(async (manager) => {
			const ebooks = manager.getRepository(EbookEntity);
			const ebook = await ebooks
				.createQueryBuilder("ebook")
				.select(["ebook.id", "ebook.uploadedBy"])
				.where("ebook.id = :id", { id })
				.setLock("pessimistic_write")
				.getOne();

			if (!ebook) throw this.ebookNotFound();
			if (ebook.uploadedBy !== userId) throw this.forbiddenUpdate();

			const fileIds = [
				dto.ebook_file_id,
				...(dto.cover_file_id ? [dto.cover_file_id] : [])
			];
			const uniqueFileIds = [...new Set(fileIds)];
			const attachedFiles = await manager
				.getRepository(LibraryFileEntity)
				.createQueryBuilder("file")
				.where("file.id IN (:...fileIds)", { fileIds: uniqueFileIds })
				.orderBy("file.id", "ASC")
				.setLock("pessimistic_read")
				.getMany();

			if (attachedFiles.length !== uniqueFileIds.length)
				throw this.invalidReference("One or more ebook files do not exist.");
			if (attachedFiles.some((file) => file.uploadedBy !== userId))
				throw this.invalidFileState(
					"One or more ebook files belong to another user."
				);

			const fileById = new Map(attachedFiles.map((file) => [file.id, file]));
			const ebookFile = fileById.get(dto.ebook_file_id);
			if (!ebookFile || !EBOOK_CONTENT_TYPES.has(ebookFile.contentType))
				throw this.invalidContentType(
					"Ebook file must be a PDF or EPUB document."
				);

			if (dto.cover_file_id) {
				const coverFile = fileById.get(dto.cover_file_id);
				if (!coverFile || !COVER_CONTENT_TYPES.has(coverFile.contentType))
					throw this.invalidContentType(
						"Cover file must be a JPEG, PNG, or WebP image."
					);
			}

			const tags = await manager.getRepository(EbookTagEntity).findBy({
				id: In(dto.tag_ids)
			});
			if (tags.length !== dto.tag_ids.length)
				throw this.invalidReference("One or more ebook tags do not exist.");

			const result = await ebooks.update(
				{ id },
				{
					title: dto.title,
					author: dto.author,
					language: dto.language,
					totalPages: dto.total_pages,
					coverFileId: dto.cover_file_id,
					ebookFileId: dto.ebook_file_id,
					overview: dto.overview
				}
			);
			if (result.affected !== 1)
				throw new Error("The locked ebook could not be updated.");

			const tagLinks = manager.getRepository(EbookTagLinkEntity);
			await tagLinks.delete({ ebookId: id });
			await tagLinks.insert(
				dto.tag_ids.map((tagId) => ({ ebookId: id, tagId }))
			);
		});

		return this.getById(id);
	}

	async delete(userId: string, id: string): Promise<void> {
		const fileIds = await this.transactions.run(async (manager) => {
			const ebooks = manager.getRepository(EbookEntity);
			const ebook = await ebooks
				.createQueryBuilder("ebook")
				.select([
					"ebook.id",
					"ebook.uploadedBy",
					"ebook.coverFileId",
					"ebook.ebookFileId"
				])
				.where("ebook.id = :id", { id })
				.setLock("pessimistic_write")
				.getOne();

			if (!ebook) throw this.ebookNotFound();
			if (ebook.uploadedBy !== userId) throw this.forbiddenDelete();

			const result = await ebooks.delete({ id });
			if (result.affected !== 1)
				throw new Error("The locked ebook could not be deleted.");

			return [
				...new Set(
					[ebook.coverFileId, ebook.ebookFileId].filter(
						(fileId): fileId is string => fileId !== null
					)
				)
			];
		});

		await this.cleanupDetachedFiles(userId, fileIds, `Ebook ${id}`);
	}

	private async getDetailData(id: string): Promise<CreatedEbookResponse> {
		const ebook = await this.ebooks.findOne({
			where: { id },
			select: {
				id: true,
				title: true,
				author: true,
				language: true,
				totalPages: true,
				overview: true,
				createdAt: true,
				updatedAt: true,
				coverFile: {
					id: true,
					fileName: true,
					contentType: true,
					sizeBytes: true,
					url: true
				},
				ebookFile: {
					id: true,
					fileName: true,
					contentType: true,
					sizeBytes: true,
					url: true
				},
				uploader: { id: true, name: true }
			},
			relations: { coverFile: true, ebookFile: true, uploader: true }
		});
		if (!ebook) throw this.ebookNotFound();
		const links = await this.tagLinks.find({
			where: { ebookId: id },
			select: {
				ebookId: true,
				tagId: true,
				tag: { id: true, label: true }
			},
			relations: { tag: true },
			order: { tagId: "ASC" }
		});

		return {
			id: ebook.id,
			title: ebook.title,
			author: ebook.author,
			language: ebook.language,
			total_pages: ebook.totalPages,
			overview: ebook.overview,
			cover_file: ebook.coverFile ? this.toFileResponse(ebook.coverFile) : null,
			ebook_file: this.toFileResponse(ebook.ebookFile),
			tags: links.map((link) => ({
				id: link.tag.id,
				label: link.tag.label
			})),
			created_at: ebook.createdAt.toISOString(),
			updated_at: ebook.updatedAt.toISOString(),
			uploaded_by: {
				id: ebook.uploader.id,
				name: ebook.uploader.name
			}
		};
	}

	private async getTagsByEbook(
		ebookIds: string[]
	): Promise<Map<string, EbookTagResponse[]>> {
		if (ebookIds.length === 0) return new Map();

		const links = await this.tagLinks.find({
			where: { ebookId: In(ebookIds) },
			select: {
				ebookId: true,
				tagId: true,
				tag: { id: true, label: true }
			},
			relations: { tag: true },
			order: { ebookId: "ASC", tagId: "ASC" }
		});
		const tagsByEbook = new Map<string, EbookTagResponse[]>();

		for (const link of links) {
			const tags = tagsByEbook.get(link.ebookId) ?? [];
			tags.push({ id: link.tag.id, label: link.tag.label });
			tagsByEbook.set(link.ebookId, tags);
		}

		return tagsByEbook;
	}

	private toListResponse(
		ebook: EbookEntity,
		tags: EbookTagResponse[]
	): EbookListItemResponse {
		return {
			id: ebook.id,
			title: ebook.title,
			author: ebook.author,
			cover_url: ebook.coverFile?.url ?? null,
			tags,
			uploaded_by: {
				id: ebook.uploader.id,
				name: ebook.uploader.name
			},
			created_at: ebook.createdAt.toISOString(),
			updated_at: ebook.updatedAt.toISOString()
		};
	}

	private toFileResponse(file: LibraryFileEntity): EbookFileResponse {
		return {
			id: file.id,
			file_name: file.fileName,
			content_type: file.contentType,
			size_bytes: file.sizeBytes,
			url: file.url
		};
	}

	private invalidReference(message: string): BadRequestException {
		return new BadRequestException({
			statusCode: HttpStatus.BAD_REQUEST,
			code: ERROR_CODES.INVALID_REFERENCE,
			message
		});
	}

	private invalidContentType(message: string): BadRequestException {
		return new BadRequestException({
			statusCode: HttpStatus.BAD_REQUEST,
			code: ERROR_CODES.VALIDATION_FAILED,
			message
		});
	}

	private invalidFileState(message: string): ConflictException {
		return new ConflictException({
			statusCode: HttpStatus.CONFLICT,
			code: ERROR_CODES.INVALID_STATE,
			message
		});
	}

	private ebookNotFound(): NotFoundException {
		return new NotFoundException({
			statusCode: HttpStatus.NOT_FOUND,
			code: ERROR_CODES.NOT_FOUND,
			message: "Ebook not found."
		});
	}

	private forbiddenUpdate(): ForbiddenException {
		return new ForbiddenException({
			statusCode: HttpStatus.FORBIDDEN,
			code: ERROR_CODES.FORBIDDEN,
			message: "You do not have permission to update this ebook."
		});
	}

	private forbiddenDelete(): ForbiddenException {
		return new ForbiddenException({
			statusCode: HttpStatus.FORBIDDEN,
			code: ERROR_CODES.FORBIDDEN,
			message: "You do not have permission to delete this ebook."
		});
	}

	private async cleanupDetachedFiles(
		userId: string,
		fileIds: string[],
		resource: string
	): Promise<void> {
		for (const fileId of fileIds) {
			try {
				await this.filesService.deleteIfUnreferenced(userId, fileId);
			} catch (error) {
				this.logger.error(
					`${resource} was deleted, but detached file ${fileId} needs cleanup (${this.errorName(error)}).`
				);
			}
		}
	}

	private errorName(error: unknown): string {
		return error instanceof Error ? error.name : "unknown error";
	}
}
