import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Post,
	Query,
	UseFilters,
	UseGuards
} from "@nestjs/common";
import { CurrentUser } from "../commons/CurrentUser";
import { Public } from "../commons/Public";
import { Roles } from "../commons/Roles";
import { RolesGuard } from "../commons/RolesGuard";
import { SnakeCaseExceptionFilter } from "../commons/SnakeCaseExceptionFilter";
import { UserRole } from "../constants/library";
import {
	CreateNotificationDto,
	GetNotificationParamsDto,
	GetNotificationsQueryDto,
	NotificationDetailResponse,
	NotificationResponse
} from "../dtos/NotificationDto";
import { PaginatedResponse } from "../dtos/PaginationDto";
import { NotificationService } from "../services/NotificationService";

@UseFilters(SnakeCaseExceptionFilter)
@UseGuards(RolesGuard)
@Controller("notifications")
export class NotificationController {
	constructor(private readonly notificationService: NotificationService) {}

	@Roles(UserRole.Admin)
	@Post()
	@HttpCode(HttpStatus.CREATED)
	async create(
		@Body() dto: CreateNotificationDto
	): Promise<NotificationDetailResponse> {
		return this.notificationService.create(dto);
	}

	@Public()
	@Get()
	@HttpCode(HttpStatus.OK)
	async list(
		@Query() query: GetNotificationsQueryDto
	): Promise<PaginatedResponse<NotificationResponse>> {
		return this.notificationService.list(query);
	}

	@Public()
	@Get(":id")
	@HttpCode(HttpStatus.OK)
	async getById(
		@Param() params: GetNotificationParamsDto
	): Promise<NotificationDetailResponse> {
		return this.notificationService.getById(params.id);
	}

	@Roles(UserRole.Admin)
	@Delete(":id")
	@HttpCode(HttpStatus.NO_CONTENT)
	async delete(
		@CurrentUser("id") userId: string,
		@Param() params: GetNotificationParamsDto
	): Promise<void> {
		return this.notificationService.delete(userId, params.id);
	}
}
