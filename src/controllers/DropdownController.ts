import {
	Body,
	Controller,
	Delete,
	HttpCode,
	HttpStatus,
	Post
} from "@nestjs/common";
import { AllowMobile } from "../commons/AllowMobile";
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

	/** Read-only, so the mobile app's magic-link JWT (`Platform: Mobile`) may fetch filter options. */
	@Post("dropdown")
	@AllowMobile()
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
