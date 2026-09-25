import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

export enum AnnouncementSubmissionType {
	Notification = "Notification",
	Announcement = "Announcement"
}

@Entity({ name: "announcements" })
export class AnnouncementEntity {
	@PrimaryGeneratedColumn()
	id: number;

	@Column({ type: "enum", enum: AnnouncementSubmissionType })
	submissionType: AnnouncementSubmissionType;

	@Column({ type: "text", nullable: true })
	topic: string | null;

	@Column({ type: "varchar", length: 255, nullable: true })
	title: string | null;

	@Column({ type: "text", nullable: true })
	teaser: string | null;

	@Column({ type: "text", nullable: true })
	fullMessage: string | null;

	@Column({ type: "text", nullable: true })
	imageUrl: string | null;

	@Column({ type: "varchar", length: 255, nullable: true })
	announcementTitle: string | null;

	@Column({ type: "varchar", length: 255, nullable: true })
	announcementMessage: string | null;

	@Column({ type: "text", nullable: true })
	bannerUrl: string | null;

	@Column({ type: "datetime", nullable: true })
	eventDate: Date | null;

	@Column({ type: "datetime", nullable: true })
	endDate: Date | null;

	@Column({ name: "created_at", type: "datetime", nullable: true })
	createdAt: Date | null;
}
