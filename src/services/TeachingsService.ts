import { BadRequestException, HttpStatus, Injectable } from "@nestjs/common";
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
	TeachingListItemResponse,
	TeachingsListResponse
} from "../dtos/TeachingDto";
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
		if (!dto.audio_url && !dto.video_url)
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
				audioUrl: dto.audio_url ?? null,
				videoUrl: dto.video_url ?? null,
				pdfUrl: dto.pdf_url ?? null,
				pptUrl: dto.ppt_url ?? null,
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
			audio_url: teaching.audioUrl,
			video_url: teaching.videoUrl,
			pdf_url: teaching.pdfUrl,
			ppt_url: teaching.pptUrl,
			created_at: teaching.createdAt.toISOString(),
			updated_at: teaching.updatedAt.toISOString(),
			uploaded_by: teaching.uploadedBy
		};
	}
}
