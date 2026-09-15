import {
	BadRequestException,
	ConflictException,
	HttpStatus,
	Injectable
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { ERROR_CODES } from "../constants/error-codes";
import {
	CreateEbookDto,
	CreateEbookResponse,
	CreatedEbookResponse,
	EbookFileResponse
} from "../dtos/EbookDto";
import { EbookEntity } from "../entities/EbookEntity";
import { EbookTagEntity } from "../entities/EbookTagEntity";
import { EbookTagLinkEntity } from "../entities/EbookTagLinkEntity";
import { LibraryFileEntity } from "../entities/LibraryFileEntity";
import { TransactionRunner } from "../utilities/TransactionRunner";

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
	constructor(
		@InjectRepository(EbookEntity)
		private readonly ebooks: Repository<EbookEntity>,
		@InjectRepository(EbookTagLinkEntity)
		private readonly tagLinks: Repository<EbookTagLinkEntity>,
		private readonly transactions: TransactionRunner
	) {}

	async create(
		userId: string,
		dto: CreateEbookDto
	): Promise<CreateEbookResponse> {
		const tagIds = dto.tag_ids ?? [];
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

			if (tagIds.length > 0) {
				const tags = await manager.getRepository(EbookTagEntity).findBy({
					id: In(tagIds)
				});
				if (tags.length !== tagIds.length)
					throw this.invalidReference("One or more ebook tags do not exist.");
			}

			const ebook = await manager.getRepository(EbookEntity).save({
				title: dto.title,
				author: dto.author,
				language: dto.language,
				totalPages: dto.total_pages ?? null,
				coverFileId: dto.cover_file_id ?? null,
				ebookFileId: dto.ebook_file_id,
				overview: dto.overview ?? null,
				uploadedBy: userId
			});

			if (tagIds.length > 0)
				await manager.getRepository(EbookTagLinkEntity).insert(
					tagIds.map((tagId) => ({ ebookId: ebook.id, tagId }))
				);

			return ebook.id;
		});

		return { data: await this.getCreatedResponse(ebookId) };
	}

	private async getCreatedResponse(id: number): Promise<CreatedEbookResponse> {
		const ebook = await this.ebooks.findOneOrFail({
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
}
