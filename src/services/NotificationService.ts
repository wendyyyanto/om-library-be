import {
	BadRequestException,
	HttpStatus,
	Injectable,
	Logger,
	NotFoundException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { randomUUID } from "node:crypto";
import { Repository } from "typeorm";
import { ERROR_CODES } from "../constants/error-codes";
import {
	CreateNotificationDto,
	GetNotificationsQueryDto,
	NotificationDetailResponse,
	NotificationResponse
} from "../dtos/NotificationDto";
import {
	DEFAULT_LIMIT,
	DEFAULT_PAGE,
	PaginatedResponse
} from "../dtos/PaginationDto";
import { LibraryFileEntity } from "../entities/LibraryFileEntity";
import { NotificationEntity } from "../entities/NotificationEntity";
import { NotificationSegmentEntity } from "../entities/NotificationSegmentEntity";
import { escapeLike } from "../utilities/escapeLike";
import { FilesService } from "./FilesService";

const ONESIGNAL_URL = "https://api.onesignal.com/notifications?c=push";
const ONESIGNAL_TIMEOUT_MS = 10_000;

@Injectable()
export class NotificationService {
	private readonly logger = new Logger(NotificationService.name);
	private readonly oneSignalAppId: string;
	private readonly oneSignalApiKey: string;

	constructor(
		@InjectRepository(NotificationEntity)
		private readonly notifications: Repository<NotificationEntity>,
		@InjectRepository(NotificationSegmentEntity)
		private readonly segments: Repository<NotificationSegmentEntity>,
		@InjectRepository(LibraryFileEntity)
		private readonly files: Repository<LibraryFileEntity>,
		private readonly filesService: FilesService,
		config: ConfigService
	) {
		const appId = config.get<string>("ONESIGNAL_APP_ID");
		const apiKey = config.get<string>("ONESIGNAL_API_KEY");
		if (!appId || !apiKey)
			throw new Error(
				"ONESIGNAL_APP_ID and ONESIGNAL_API_KEY must be set — refusing to start without push delivery"
			);
		this.oneSignalAppId = appId;
		this.oneSignalApiKey = apiKey;
	}

	async create(dto: CreateNotificationDto): Promise<NotificationDetailResponse> {
		const segment = await this.segments.findOneBy({ id: dto.segment_id });
		if (!segment) throw this.invalid("Segment does not exist!");

		let thumbnailUrl: string | null = null;
		if (dto.thumbnail_file_id) {
			const file = await this.files.findOne({
				select: { id: true, contentType: true, url: true },
				where: { id: dto.thumbnail_file_id }
			});
			if (!file) throw this.invalid("Thumbnail file does not exist!");
			if (!file.contentType.startsWith("image/"))
				throw this.invalid("Thumbnail file must be an image!");
			thumbnailUrl = file.url;
		}

		const id = randomUUID();
		await this.notifications.insert({
			id,
			segmentId: segment.id,
			title: dto.title,
			description: dto.description,
			thumbnailFileId: dto.thumbnail_file_id ?? null,
			eventDate: new Date(dto.event_date)
		});

		// The row is kept even when the push fails; onesignal_id stays NULL to mark it.
		const onesignalId = await this.sendPush(
			id,
			segment.name,
			dto.title,
			dto.description,
			thumbnailUrl
		);
		if (onesignalId) await this.notifications.update({ id }, { onesignalId });

		return this.getById(id);
	}

	async list(
		query: GetNotificationsQueryDto
	): Promise<PaginatedResponse<NotificationResponse>> {
		const page = query.page ?? DEFAULT_PAGE;
		const limit = query.limit ?? DEFAULT_LIMIT;

		const builder = this.detailQuery();
		if (query.segment_id)
			builder.andWhere("notification.segmentId = :segmentId", {
				segmentId: query.segment_id
			});
		if (query.q)
			builder.andWhere("notification.title LIKE :q", {
				q: `%${escapeLike(query.q)}%`
			});

		const [rows, totalItems] = await builder
			.orderBy("notification.eventDate", "DESC")
			.addOrderBy("notification.id", "DESC")
			.skip((page - 1) * limit)
			.take(limit)
			.getManyAndCount();

		return {
			data: rows.map((row) => this.toResponse(row)),
			pagination: {
				page,
				limit,
				total_items: totalItems,
				total_pages: Math.ceil(totalItems / limit)
			}
		};
	}

	async getById(id: string): Promise<NotificationDetailResponse> {
		const notification = await this.detailQuery()
			.where("notification.id = :id", { id })
			.getOne();
		if (!notification) throw this.notFound();
		return { data: this.toResponse(notification) };
	}

	async delete(userId: string, id: string): Promise<void> {
		const notification = await this.notifications.findOne({
			select: { id: true, thumbnailFileId: true },
			where: { id }
		});
		if (!notification) throw this.notFound();

		await this.notifications.delete({ id });

		if (!notification.thumbnailFileId) return;
		try {
			await this.filesService.deleteIfUnreferenced(
				userId,
				notification.thumbnailFileId
			);
		} catch (error) {
			this.logger.error(
				`Notification ${id} was deleted, but thumbnail ${notification.thumbnailFileId} needs cleanup (${this.errorName(error)}).`
			);
		}
	}

	/** Returns the OneSignal notification id, or null when nothing was sent. Never throws. */
	private async sendPush(
		id: string,
		segmentName: string,
		title: string,
		description: string,
		thumbnailUrl: string | null
	): Promise<string | null> {
		try {
			const response = await fetch(ONESIGNAL_URL, {
				method: "POST",
				headers: {
					Authorization: `Key ${this.oneSignalApiKey}`,
					"Content-Type": "application/json"
				},
				body: JSON.stringify({
					app_id: this.oneSignalAppId,
					included_segments: [segmentName],
					headings: { en: title },
					contents: { en: description },
					data: { notification_id: id },
					idempotency_key: id,
					...(thumbnailUrl
						? {
								big_picture: thumbnailUrl,
								ios_attachments: { thumbnail: thumbnailUrl }
							}
						: {})
				}),
				signal: AbortSignal.timeout(ONESIGNAL_TIMEOUT_MS)
			});
			const body = (await response.json().catch(() => null)) as {
				id?: string;
				errors?: unknown;
			} | null;

			if (!response.ok || !body?.id) {
				this.logger.error(
					`OneSignal push for notification ${id} was not sent (status ${response.status}): ${JSON.stringify(body?.errors ?? body)}`
				);
				return null;
			}
			return body.id;
		} catch (error) {
			this.logger.error(
				`OneSignal push for notification ${id} failed (${this.errorName(error)}).`
			);
			return null;
		}
	}

	private detailQuery() {
		return this.notifications
			.createQueryBuilder("notification")
			.innerJoin("notification.segment", "segment")
			.leftJoin("notification.thumbnailFile", "thumbnailFile")
			.select([
				"notification.id",
				"notification.title",
				"notification.description",
				"notification.eventDate",
				"notification.onesignalId",
				"notification.createdAt",
				"notification.updatedAt",
				"segment.id",
				"segment.name",
				"thumbnailFile.id",
				"thumbnailFile.url"
			]);
	}

	private toResponse(notification: NotificationEntity): NotificationResponse {
		return {
			id: notification.id,
			title: notification.title,
			description: notification.description,
			event_date: notification.eventDate.toISOString(),
			segment: {
				id: notification.segment.id,
				name: notification.segment.name
			},
			thumbnail: notification.thumbnailFile
				? {
						id: notification.thumbnailFile.id,
						url: notification.thumbnailFile.url
					}
				: null,
			onesignal_id: notification.onesignalId,
			created_at: notification.createdAt.toISOString(),
			updated_at: notification.updatedAt.toISOString()
		};
	}

	private invalid(message: string): BadRequestException {
		return new BadRequestException({
			statusCode: HttpStatus.BAD_REQUEST,
			code: ERROR_CODES.VALIDATION_FAILED,
			message,
			errors: [message]
		});
	}

	private notFound(): NotFoundException {
		return new NotFoundException({
			statusCode: HttpStatus.NOT_FOUND,
			code: ERROR_CODES.NOT_FOUND,
			message: "Notification not found."
		});
	}

	private errorName(error: unknown): string {
		return error instanceof Error ? error.name : "UnknownError";
	}
}
