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
	CreateEbookDto,
	CreateEbookResponse,
	EbookDetailResponse,
	EbooksListResponse,
	GetEbookParamsDto,
	UpdateEbookDto,
	UpdateEbookResponse
} from "../dtos/EbookDto";
import { GetPaginationQueryDto } from "../dtos/PaginationDto";
import { EbookService } from "../services/EbookService";

@Controller()
export class EbookController {
	constructor(private readonly ebookService: EbookService) {}

	@Post("ebook")
	@HttpCode(HttpStatus.CREATED)
	async create(
		@CurrentUser("id") userId: string,
		@Body() dto: CreateEbookDto
	): Promise<CreateEbookResponse> {
		return this.ebookService.create(userId, dto);
	}

	@Public()
	@Get("ebooks")
	@HttpCode(HttpStatus.OK)
	async list(
		@Query() query: GetPaginationQueryDto
	): Promise<EbooksListResponse> {
		return this.ebookService.list(query);
	}

	@Public()
	@Get("ebook/:id")
	@HttpCode(HttpStatus.OK)
	async getById(
		@Param() params: GetEbookParamsDto
	): Promise<EbookDetailResponse> {
		return this.ebookService.getById(params.id);
	}

	@Put("ebook/:id")
	@HttpCode(HttpStatus.OK)
	async update(
		@CurrentUser("id") userId: string,
		@Param() params: GetEbookParamsDto,
		@Body() dto: UpdateEbookDto
	): Promise<UpdateEbookResponse> {
		return this.ebookService.update(userId, params.id, dto);
	}

	@Delete("ebook/:id")
	@HttpCode(HttpStatus.NO_CONTENT)
	async delete(
		@CurrentUser("id") userId: string,
		@Param() params: GetEbookParamsDto
	): Promise<void> {
		return this.ebookService.delete(userId, params.id);
	}
}
