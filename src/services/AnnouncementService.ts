import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Like, Repository } from "typeorm";
import {
	AnnouncementEntity,
	AnnouncementSubmissionType
} from "../entities/AnnouncementEntity";
import { escapeLike } from "../utilities/escapeLike";

/** Mirrors the mobile API's `/v1/announcements` payloads, with snake_case keys. */
@Injectable()
export class AnnouncementService {
	constructor(
		@InjectRepository(AnnouncementEntity)
		private readonly announcements: Repository<AnnouncementEntity>
	) {}

	async list(q: string) {
		const rows = await this.announcements.find({
			select: { id: true, announcementTitle: true, bannerUrl: true },
			where: {
				submissionType: AnnouncementSubmissionType.Announcement,
				...(q ? { announcementTitle: Like(`%${escapeLike(q)}%`) } : {})
			},
			order: { endDate: "DESC" }
		});
		return rows.map((row) => ({
			id: row.id,
			announcement_title: row.announcementTitle,
			banner_url: row.bannerUrl
		}));
	}

	/** Returns an array (0 or 1 item), matching the mobile API. */
	async getById(id: number) {
		const rows = await this.announcements.find({
			select: { id: true, announcementTitle: true, fullMessage: true },
			where: { id, submissionType: AnnouncementSubmissionType.Announcement },
			take: 1
		});
		return rows.map((row) => ({
			id: row.id,
			announcement_title: row.announcementTitle,
			full_message: row.fullMessage
		}));
	}
}
