import {
	Body,
	Controller,
	Delete,
	HttpCode,
	HttpStatus,
	Post
} from "@nestjs/common";
import {
	DropdownOptionsCreateDto,
	DropdownRequestDto,
	DropdownResponse,
	PaginatedDropdownResponse
} from "../dtos/DropdownDto";
import { DropdownService } from "../services/DropdownService";

@Controller()
export class DropdownController {
	constructor(private readonly dropdownService: DropdownService) {}

	@Post("dropdown")
	@HttpCode(HttpStatus.OK)
	async getOptions(
		@Body() dto: DropdownRequestDto
	): Promise<DropdownResponse | PaginatedDropdownResponse> {
		return this.dropdownService.getOptions(dto);
	}

	@Post("dropdown-options")
	@HttpCode(HttpStatus.CREATED)
	async createOptions(
		@Body() dto: DropdownOptionsCreateDto
	): Promise<DropdownResponse> {
		return this.dropdownService.createOptions(dto);
	}
}
