import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import {
	DropdownRequestDto,
	DropdownResponse,
	PaginatedDropdownResponse
} from "../dtos/DropdownDto";
import { DropdownService } from "../services/DropdownService";

@Controller("dropdown")
export class DropdownController {
	constructor(private readonly dropdownService: DropdownService) {}

	@Post()
	@HttpCode(HttpStatus.OK)
	async getOptions(
		@Body() dto: DropdownRequestDto
	): Promise<DropdownResponse | PaginatedDropdownResponse> {
		return this.dropdownService.getOptions(dto);
	}
}
