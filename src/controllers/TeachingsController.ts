import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Post,
	Query,
	UseFilters
} from "@nestjs/common";
import { SnakeCaseExceptionFilter } from "../commons/SnakeCaseExceptionFilter";
import { CurrentUser } from "../commons/CurrentUser";
import {
	CreateTeachingDto,
	CreateTeachingResponse,
	GetTeachingParamsDto,
	GetTeachingsQueryDto,
	TeachingDetailResponse,
	TeachingsListResponse
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

	@Get()
	@HttpCode(HttpStatus.OK)
	async list(
		@Query() query: GetTeachingsQueryDto
	): Promise<TeachingsListResponse> {
		return this.teachingsService.list(query);
	}

	@Get(":id")
	@HttpCode(HttpStatus.OK)
	async getById(
		@Param() params: GetTeachingParamsDto
	): Promise<TeachingDetailResponse> {
		return this.teachingsService.getById(params.id);
	}
}
