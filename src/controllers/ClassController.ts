import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { CurrentUser } from "../commons/CurrentUser";
import { CreateClassDto, CreateClassResponse } from "../dtos/ClassDto";
import { ClassService } from "../services/ClassService";

@Controller("class")
export class ClassController {
	constructor(private readonly classService: ClassService) {}

	@Post()
	@HttpCode(HttpStatus.CREATED)
	async create(
		@CurrentUser("id") userId: string,
		@Body() dto: CreateClassDto
	): Promise<CreateClassResponse> {
		return this.classService.create(userId, dto);
	}
}
