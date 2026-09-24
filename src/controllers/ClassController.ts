import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Post,
	Put,
	Query
} from "@nestjs/common";
import { CurrentUser } from "../commons/CurrentUser";
import { Public } from "../commons/Public";
import {
	CreateClassDto,
	CreateClassMaterialDto,
	CreateClassMaterialResponse,
	CreateClassResponse,
	ClassDetailResponse,
	ClassesListResponse,
	GetClassParamsDto,
	UpdateClassMaterialDto,
	UpdateClassMaterialParamsDto,
	UpdateClassMaterialResponse,
	UpdateClassDto,
	UpdateClassResponse
} from "../dtos/ClassDto";
import { GetPaginationQueryDto } from "../dtos/PaginationDto";
import { ClassService } from "../services/ClassService";

@Controller()
export class ClassController {
	constructor(private readonly classService: ClassService) {}

	@Post("class")
	@HttpCode(HttpStatus.CREATED)
	async create(
		@CurrentUser("id") userId: string,
		@Body() dto: CreateClassDto
	): Promise<CreateClassResponse> {
		return this.classService.create(userId, dto);
	}

	@Post("class/:id/materials")
	@HttpCode(HttpStatus.CREATED)
	async createMaterial(
		@CurrentUser("id") userId: string,
		@Param() params: GetClassParamsDto,
		@Body() dto: CreateClassMaterialDto
	): Promise<CreateClassMaterialResponse> {
		return this.classService.createMaterial(userId, params.id, dto);
	}

	@Public()
	@Get("classes")
	@HttpCode(HttpStatus.OK)
	async list(
		@Query() query: GetPaginationQueryDto
	): Promise<ClassesListResponse> {
		return this.classService.list(query);
	}

	@Public()
	@Get("class/:id")
	@HttpCode(HttpStatus.OK)
	async getById(
		@Param() params: GetClassParamsDto
	): Promise<ClassDetailResponse> {
		return this.classService.getById(params.id);
	}

	@Put("class/:classId/materials/:materialId")
	@HttpCode(HttpStatus.OK)
	async updateMaterial(
		@CurrentUser("id") userId: string,
		@Param() params: UpdateClassMaterialParamsDto,
		@Body() dto: UpdateClassMaterialDto
	): Promise<UpdateClassMaterialResponse> {
		return this.classService.updateMaterial(
			userId,
			params.classId,
			params.materialId,
			dto
		);
	}

	@Put("class/:id")
	@HttpCode(HttpStatus.OK)
	async update(
		@CurrentUser("id") userId: string,
		@Param() params: GetClassParamsDto,
		@Body() dto: UpdateClassDto
	): Promise<UpdateClassResponse> {
		return this.classService.update(userId, params.id, dto);
	}

	@Delete("class/:id")
	@HttpCode(HttpStatus.NO_CONTENT)
	async delete(
		@CurrentUser("id") userId: string,
		@Param() params: GetClassParamsDto
	): Promise<void> {
		return this.classService.delete(userId, params.id);
	}
}
