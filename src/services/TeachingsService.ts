import {
	BadRequestException,
	HttpStatus,
	Injectable,
	NotFoundException
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { randomUUID } from "node:crypto";
import { Repository } from "typeorm";
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

@Injectable()
export class TeachingsService {
	constructor(
		@InjectRepository(TeachingEntity)
		private readonly teachings: Repository<TeachingEntity>
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
				uploadedBy: true
			},
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
			.leftJoinAndSelect(
				"teaching.audioFile",
				"audioFile",
				"audioFile.deletedAt IS NULL"
			)
			.leftJoinAndSelect(
				"teaching.pdfFile",
				"pdfFile",
				"pdfFile.deletedAt IS NULL"
			)
			.leftJoinAndSelect(
				"teaching.pptFile",
				"pptFile",
				"pptFile.deletedAt IS NULL"
			)
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
				"teaching.uploadedBy",
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

	private toResponse(teaching: TeachingEntity): TeachingListItemResponse {
		return {
			id: teaching.id,
			title: teaching.title,
			category: teaching.category,
			teacher: teaching.teacher,
			date: teaching.createdAt.toISOString(),
			uploaded_by: teaching.uploadedBy
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
			uploaded_by: teaching.uploadedBy
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
}
