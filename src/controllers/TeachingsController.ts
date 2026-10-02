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
	Query,
	UseFilters
} from "@nestjs/common";
import { SnakeCaseExceptionFilter } from "../commons/SnakeCaseExceptionFilter";
import { CurrentUser } from "../commons/CurrentUser";
import { Public } from "../commons/Public";
import {
	CreateTeachingDto,
	CreateTeachingResponse,
	GetTeachingParamsDto,
	GetTeachingsQueryDto,
	TeachingDetailResponse,
	TeachingsListResponse,
	UpdateTeachingDto
} from "../dtos/TeachingDto";
import { TeachingsService } from "../services/TeachingsService";

@UseFilters(SnakeCaseExceptionFilter)
@Controller("teachings")
export class TeachingsController {
	constructor(private readonly teachingsService: TeachingsService) {}

	@Post()
	@HttpCode(HttpStatus.CREATED)
	async create(
		@CurrentUser("id") userId: string,
		@Body() dto: CreateTeachingDto
	): Promise<CreateTeachingResponse> {
		return this.teachingsService.create(userId, dto);
	}

	@Public()
	@Get()
	@HttpCode(HttpStatus.OK)
	async list(
		@Query() query: GetTeachingsQueryDto
	): Promise<TeachingsListResponse> {
		return this.teachingsService.list(query);
	}

	@Public()
	@Get(":id")
	@HttpCode(HttpStatus.OK)
	async getById(
		@Param() params: GetTeachingParamsDto
	): Promise<TeachingDetailResponse> {
		return this.teachingsService.getById(params.id);
	}

	@Put(":id")
	@HttpCode(HttpStatus.OK)
	async update(
		@CurrentUser("id") userId: string,
		@Param() params: GetTeachingParamsDto,
		@Body() dto: UpdateTeachingDto
	): Promise<TeachingDetailResponse> {
		return this.teachingsService.update(userId, params.id, dto);
	}

	@Delete(":id")
	@HttpCode(HttpStatus.NO_CONTENT)
	async delete(
		@CurrentUser("id") userId: string,
		@Param() params: GetTeachingParamsDto
	): Promise<void> {
		return this.teachingsService.delete(userId, params.id);
	}
}
