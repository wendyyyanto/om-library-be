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
import { Repository } from "typeorm";
import { ERROR_CODES } from "../constants/error-codes";
import {
	CreateClassDto,
	CreateClassMaterialDto,
	CreateClassMaterialResponse,
	CreateClassResponse,
	ClassDetailResponse,
	ClassMaterialDetailResponse,
	ClassesListResponse,
	ClassListItemResponse,
	CreatedClassMaterialResponse,
	CreatedClassResponse,
	ClassMaterialFileResponse,
	UpdateClassDto,
	UpdateClassMaterialDto,
	UpdateClassMaterialResponse,
	UpdateClassResponse
} from "../dtos/ClassDto";
import {
	DEFAULT_LIMIT,
	DEFAULT_PAGE,
	GetPaginationQueryDto
} from "../dtos/PaginationDto";
import { ClassCategoryEntity } from "../entities/ClassCategoryEntity";
import { ClassEntity } from "../entities/ClassEntity";
import { ClassMaterialEntity } from "../entities/ClassMaterialEntity";
import { LibraryFileEntity } from "../entities/LibraryFileEntity";
import { TransactionRunner } from "../utilities/TransactionRunner";
import { FilesService } from "./FilesService";

const CLASS_MATERIAL_DOCUMENT_TYPES = new Set([
	"application/pdf",
	"application/vnd.ms-powerpoint",
	"application/vnd.openxmlformats-officedocument.presentationml.presentation"
]);

const MATERIAL_FILE_SELECT = {
	id: true,
	fileName: true,
	contentType: true,
	sizeBytes: true,
	url: true
} as const;

@Injectable()
export class ClassService {
	private readonly logger = new Logger(ClassService.name);

	constructor(
		@InjectRepository(ClassEntity)
		private readonly classes: Repository<ClassEntity>,
		@InjectRepository(ClassCategoryEntity)
		private readonly categories: Repository<ClassCategoryEntity>,
		@InjectRepository(ClassMaterialEntity)
		private readonly materials: Repository<ClassMaterialEntity>,
		private readonly filesService: FilesService,
		private readonly transactions: TransactionRunner
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

	async list(query: GetPaginationQueryDto): Promise<ClassesListResponse> {
		const page = query.page ?? DEFAULT_PAGE;
		const limit = query.limit ?? DEFAULT_LIMIT;
		const [classes, totalItems] = await this.classes.findAndCount({
			select: {
				id: true,
				title: true,
				totalWeeks: true,
				createdAt: true,
				updatedAt: true,
				category: { id: true, label: true },
				uploader: { id: true, name: true }
			},
			relations: { category: true, uploader: true },
			order: { createdAt: "DESC", id: "DESC" },
			skip: (page - 1) * limit,
			take: limit
		});

		return {
			data: classes.map((classRecord) =>
				this.toListResponse(classRecord)
			),
			pagination: {
				page,
				limit,
				total_items: totalItems,
				total_pages: Math.ceil(totalItems / limit)
			}
		};
	}

	async getById(id: number): Promise<ClassDetailResponse> {
		const classRecord = await this.classes.findOne({
			where: { id },
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
		if (!classRecord) throw this.classNotFound();

		const materials = await this.materials.find({
			where: { classId: id },
			select: {
				id: true,
				classId: true,
				title: true,
				weekNumber: true,
				createdAt: true,
				updatedAt: true,
				file: MATERIAL_FILE_SELECT
			},
			relations: { file: true },
			order: { weekNumber: "ASC", id: "ASC" }
		});

		return {
			data: {
				id: classRecord.id,
				title: classRecord.title,
				description: classRecord.description,
				total_weeks: classRecord.totalWeeks,
				class_category: {
					id: classRecord.category.id,
					label: classRecord.category.label
				},
				uploaded_by: {
					id: classRecord.uploader.id,
					name: classRecord.uploader.name
				},
				materials: materials.map((material) =>
					this.toMaterialDetailResponse(material)
				),
				created_at: classRecord.createdAt.toISOString(),
				updated_at: classRecord.updatedAt.toISOString()
			}
		};
	}

	async update(
		userId: string,
		id: number,
		dto: UpdateClassDto
	): Promise<UpdateClassResponse> {
		await this.transactions.run(async (manager) => {
			const classes = manager.getRepository(ClassEntity);
			const classRecord = await classes
				.createQueryBuilder("classRecord")
				.select([
					"classRecord.id",
					"classRecord.title",
					"classRecord.uploadedBy"
				])
				.where("classRecord.id = :id", { id })
				.setLock("pessimistic_write")
				.getOne();

			if (!classRecord) throw this.classNotFound();
			if (classRecord.uploadedBy !== userId) throw this.forbiddenUpdate();

			const categoryExists = await manager
				.getRepository(ClassCategoryEntity)
				.existsBy({ id: dto.class_category_id });
			if (!categoryExists) throw this.invalidCategory();

			const materials = manager.getRepository(ClassMaterialEntity);
			if (
				dto.total_weeks !== null &&
				(await materials
					.createQueryBuilder("material")
					.where("material.classId = :classId", { classId: id })
					.andWhere("material.weekNumber > :totalWeeks", {
						totalWeeks: dto.total_weeks
					})
					.getExists())
			)
				throw this.totalWeeksBelowMaterial();

			const result = await classes.update(
				{ id },
				{
					title: dto.title,
					description: dto.description,
					totalWeeks: dto.total_weeks,
					classCategoryId: dto.class_category_id
				}
			);
			if (result.affected !== 1)
				throw new Error("The locked class could not be updated.");
		});

		return this.getById(id);
	}

	async delete(userId: string, id: number): Promise<void> {
		const fileIds = await this.transactions.run(async (manager) => {
			const classes = manager.getRepository(ClassEntity);
			const classRecord = await classes
				.createQueryBuilder("classRecord")
				.select(["classRecord.id", "classRecord.uploadedBy"])
				.where("classRecord.id = :id", { id })
				.setLock("pessimistic_write")
				.getOne();

			if (!classRecord) throw this.classNotFound();
			if (classRecord.uploadedBy !== userId) throw this.forbiddenDelete();

			const materials = await manager
				.getRepository(ClassMaterialEntity)
				.find({ where: { classId: id }, select: { fileId: true } });

			const result = await classes.delete({ id });
			if (result.affected !== 1)
				throw new Error("The locked class could not be deleted.");

			return [...new Set(materials.map((material) => material.fileId))];
		});

		await this.cleanupDetachedFiles(userId, fileIds, `Class ${id}`);
	}

	async createMaterial(
		userId: string,
		classId: number,
		dto: CreateClassMaterialDto
	): Promise<CreateClassMaterialResponse> {
		const result = await this.transactions.run(async (manager) => {
			const classRecord = await manager
				.getRepository(ClassEntity)
				.createQueryBuilder("classRecord")
				.select([
					"classRecord.id",
					"classRecord.title",
					"classRecord.totalWeeks",
					"classRecord.uploadedBy"
				])
				.where("classRecord.id = :classId", { classId })
				.setLock("pessimistic_read")
				.getOne();

			if (!classRecord) throw this.classNotFound();
			if (classRecord.uploadedBy !== userId) throw this.forbidden();
			if (
				dto.week !== null &&
				dto.week !== undefined &&
				classRecord.totalWeeks !== null &&
				dto.week > classRecord.totalWeeks
			)
				throw this.weekOutsideClass(classRecord.totalWeeks);

			const uploadPath = this.materialUploadPath(classRecord.title);
			const file = await manager
				.getRepository(LibraryFileEntity)
				.createQueryBuilder("file")
				.where("file.id = :fileId", { fileId: dto.file_id })
				.setLock("pessimistic_read")
				.getOne();

			if (!file)
				throw this.invalidReference(
					"Class material file does not exist."
				);
			if (file.uploadedBy !== userId)
				throw this.invalidFileState(
					"Class material file belongs to another user."
				);
			if (!this.isMaterialFile(file.contentType))
				throw this.invalidMaterialType();

			const material = await manager
				.getRepository(ClassMaterialEntity)
				.save({
					classId,
					title: dto.title,
					weekNumber: dto.week ?? null,
					fileId: dto.file_id
				});

			return { materialId: material.id, uploadPath };
		});

		return {
			data: await this.getCreatedMaterialResponse(
				result.materialId,
				result.uploadPath
			)
		};
	}

	async updateMaterial(
		userId: string,
		classId: number,
		materialId: number,
		dto: UpdateClassMaterialDto
	): Promise<UpdateClassMaterialResponse> {
		const uploadPath = await this.transactions.run(async (manager) => {
			const classRecord = await manager
				.getRepository(ClassEntity)
				.createQueryBuilder("classRecord")
				.select([
					"classRecord.id",
					"classRecord.title",
					"classRecord.totalWeeks",
					"classRecord.uploadedBy"
				])
				.where("classRecord.id = :classId", { classId })
				.setLock("pessimistic_read")
				.getOne();

			if (!classRecord) throw this.classNotFound();
			if (classRecord.uploadedBy !== userId) throw this.forbidden();

			const materials = manager.getRepository(ClassMaterialEntity);
			const material = await materials
				.createQueryBuilder("material")
				.select(["material.id", "material.classId"])
				.where("material.id = :materialId", { materialId })
				.andWhere("material.classId = :classId", { classId })
				.setLock("pessimistic_write")
				.getOne();
			if (!material) throw this.materialNotFound();

			if (
				dto.week !== null &&
				classRecord.totalWeeks !== null &&
				dto.week > classRecord.totalWeeks
			)
				throw this.weekOutsideClass(classRecord.totalWeeks);

			const nextUploadPath = this.materialUploadPath(classRecord.title);
			const file = await manager
				.getRepository(LibraryFileEntity)
				.createQueryBuilder("file")
				.where("file.id = :fileId", { fileId: dto.file_id })
				.setLock("pessimistic_read")
				.getOne();

			if (!file)
				throw this.invalidReference(
					"Class material file does not exist."
				);
			if (file.uploadedBy !== userId)
				throw this.invalidFileState(
					"Class material file belongs to another user."
				);
			if (!this.isMaterialFile(file.contentType))
				throw this.invalidMaterialType();

			const updateResult = await materials.update(
				{ id: materialId, classId },
				{
					title: dto.title,
					weekNumber: dto.week,
					fileId: dto.file_id
				}
			);
			if (updateResult.affected !== 1)
				throw new Error(
					"The locked class material could not be updated."
				);

			return nextUploadPath;
		});

		return {
			data: await this.getCreatedMaterialResponse(materialId, uploadPath)
		};
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

	private toListResponse(classRecord: ClassEntity): ClassListItemResponse {
		return {
			id: classRecord.id,
			title: classRecord.title,
			total_weeks: classRecord.totalWeeks,
			class_category: {
				id: classRecord.category.id,
				label: classRecord.category.label
			},
			uploaded_by: {
				id: classRecord.uploader.id,
				name: classRecord.uploader.name
			},
			created_at: classRecord.createdAt.toISOString(),
			updated_at: classRecord.updatedAt.toISOString()
		};
	}

	private async getCreatedMaterialResponse(
		id: number,
		uploadPath: string
	): Promise<CreatedClassMaterialResponse> {
		const material = await this.materials.findOneOrFail({
			where: { id },
			select: {
				id: true,
				classId: true,
				title: true,
				weekNumber: true,
				createdAt: true,
				updatedAt: true,
				file: MATERIAL_FILE_SELECT
			},
			relations: { file: true }
		});

		return {
			id: material.id,
			class_id: material.classId,
			week: material.weekNumber,
			title: material.title,
			upload_path: uploadPath,
			file: this.toMaterialFileResponse(material.file),
			created_at: material.createdAt.toISOString(),
			updated_at: material.updatedAt.toISOString()
		};
	}

	private toMaterialDetailResponse(
		material: ClassMaterialEntity
	): ClassMaterialDetailResponse {
		return {
			id: material.id,
			week: material.weekNumber,
			title: material.title,
			file: this.toMaterialFileResponse(material.file),
			created_at: material.createdAt.toISOString(),
			updated_at: material.updatedAt.toISOString()
		};
	}

	private toMaterialFileResponse(
		file: LibraryFileEntity
	): ClassMaterialFileResponse {
		return {
			id: file.id,
			file_name: file.fileName,
			content_type: file.contentType,
			size_bytes: file.sizeBytes,
			url: file.url
		};
	}

	private materialUploadPath(classTitle: string): string {
		return `Classes/${classTitle}`;
	}

	private isMaterialFile(contentType: string): boolean {
		return (
			CLASS_MATERIAL_DOCUMENT_TYPES.has(contentType) ||
			contentType.startsWith("audio/") ||
			contentType.startsWith("video/")
		);
	}

	private invalidCategory(): BadRequestException {
		return new BadRequestException({
			statusCode: HttpStatus.BAD_REQUEST,
			code: ERROR_CODES.INVALID_REFERENCE,
			message: "Class category does not exist."
		});
	}

	private classNotFound(): NotFoundException {
		return new NotFoundException({
			statusCode: HttpStatus.NOT_FOUND,
			code: ERROR_CODES.NOT_FOUND,
			message: "Class not found."
		});
	}

	private materialNotFound(): NotFoundException {
		return new NotFoundException({
			statusCode: HttpStatus.NOT_FOUND,
			code: ERROR_CODES.NOT_FOUND,
			message: "Class material not found."
		});
	}

	private forbidden(): ForbiddenException {
		return new ForbiddenException({
			statusCode: HttpStatus.FORBIDDEN,
			code: ERROR_CODES.FORBIDDEN,
			message:
				"You do not have permission to add materials to this class."
		});
	}

	private forbiddenUpdate(): ForbiddenException {
		return new ForbiddenException({
			statusCode: HttpStatus.FORBIDDEN,
			code: ERROR_CODES.FORBIDDEN,
			message: "You do not have permission to update this class."
		});
	}

	private weekOutsideClass(totalWeeks: number): BadRequestException {
		return new BadRequestException({
			statusCode: HttpStatus.BAD_REQUEST,
			code: ERROR_CODES.VALIDATION_FAILED,
			message: `Week cannot be greater than the class total of ${totalWeeks}.`
		});
	}

	private invalidReference(message: string): BadRequestException {
		return new BadRequestException({
			statusCode: HttpStatus.BAD_REQUEST,
			code: ERROR_CODES.INVALID_REFERENCE,
			message
		});
	}

	private invalidMaterialType(): BadRequestException {
		return new BadRequestException({
			statusCode: HttpStatus.BAD_REQUEST,
			code: ERROR_CODES.VALIDATION_FAILED,
			message:
				"Class material files must be PDF, PowerPoint, audio, or video."
		});
	}

	private invalidFileState(message: string): ConflictException {
		return new ConflictException({
			statusCode: HttpStatus.CONFLICT,
			code: ERROR_CODES.INVALID_STATE,
			message
		});
	}

	private totalWeeksBelowMaterial(): ConflictException {
		return new ConflictException({
			statusCode: HttpStatus.CONFLICT,
			code: ERROR_CODES.INVALID_STATE,
			message:
				"Total weeks cannot be lower than an existing material week."
		});
	}

	private forbiddenDelete(): ForbiddenException {
		return new ForbiddenException({
			statusCode: HttpStatus.FORBIDDEN,
			code: ERROR_CODES.FORBIDDEN,
			message: "You do not have permission to delete this class."
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
