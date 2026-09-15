import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { CurrentUser } from "../commons/CurrentUser";
import { CreateEbookDto, CreateEbookResponse } from "../dtos/EbookDto";
import { EbookService } from "../services/EbookService";

@Controller("ebook")
export class EbookController {
	constructor(private readonly ebookService: EbookService) {}

	@Post()
	@HttpCode(HttpStatus.CREATED)
	async create(
		@CurrentUser("id") userId: string,
		@Body() dto: CreateEbookDto
	): Promise<CreateEbookResponse> {
		return this.ebookService.create(userId, dto);
	}
}
