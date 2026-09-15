import { BadRequestException, HttpStatus, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ERROR_CODES } from "../constants/error-codes";
import {
	CreateClassDto,
	CreateClassResponse,
	CreatedClassResponse
} from "../dtos/ClassDto";
import { ClassCategoryEntity } from "../entities/ClassCategoryEntity";
import { ClassEntity } from "../entities/ClassEntity";

@Injectable()
export class ClassService {
	constructor(
		@InjectRepository(ClassEntity)
		private readonly classes: Repository<ClassEntity>,
		@InjectRepository(ClassCategoryEntity)
		private readonly categories: Repository<ClassCategoryEntity>
	) {}

	async create(
		userId: string,
		dto: CreateClassDto
	): Promise<CreateClassResponse> {
		const categoryExists = await this.categories.existsBy({
			id: dto.class_category_id
		});
		if (!categoryExists) throw this.invalidCategory();

		const created = await this.classes.save(
			this.classes.create({
				title: dto.title,
				description: dto.description ?? null,
				totalWeeks: dto.total_weeks ?? null,
				classCategoryId: dto.class_category_id,
				uploadedBy: userId
			})
		);

		const classRecord = await this.classes.findOneOrFail({
			where: { id: created.id },
			select: {
				id: true,
				title: true,
				description: true,
				totalWeeks: true,
				createdAt: true,
				updatedAt: true,
				category: { id: true, label: true },
				uploader: { id: true, name: true }
			},
			relations: { category: true, uploader: true }
		});

		return { data: this.toResponse(classRecord) };
	}

	private toResponse(classRecord: ClassEntity): CreatedClassResponse {
		return {
			id: classRecord.id,
			title: classRecord.title,
			description: classRecord.description,
			total_weeks: classRecord.totalWeeks,
			class_category: {
				id: classRecord.category.id,
				label: classRecord.category.label
			},
			created_at: classRecord.createdAt.toISOString(),
			updated_at: classRecord.updatedAt.toISOString(),
			uploaded_by: {
				id: classRecord.uploader.id,
				name: classRecord.uploader.name
			}
		};
	}

	private invalidCategory(): BadRequestException {
		return new BadRequestException({
			statusCode: HttpStatus.BAD_REQUEST,
			code: ERROR_CODES.INVALID_REFERENCE,
			message: "Class category does not exist."
		});
	}
}
