import {
	Column,
	CreateDateColumn,
	Entity,
	Index,
	JoinColumn,
	ManyToOne,
	PrimaryColumn,
	UpdateDateColumn
} from "typeorm";
import { LibraryFileEntity } from "./LibraryFileEntity";
import { NotificationSegmentEntity } from "./NotificationSegmentEntity";

@Entity({ name: "notifications" })
@Index("idx_notifications_segment_id", ["segmentId"])
@Index("idx_notifications_thumbnail_file_id", ["thumbnailFileId"])
@Index("idx_notifications_event_date", ["eventDate"])
export class NotificationEntity {
	@PrimaryColumn({ type: "char", length: 36 })
	id: string;

	@Column({ name: "segment_id", type: "int", unsigned: true })
	segmentId: number;

	@ManyToOne(() => NotificationSegmentEntity, { nullable: false })
	@JoinColumn({
		name: "segment_id",
		foreignKeyConstraintName: "fk_notifications_segment_id"
	})
	segment: NotificationSegmentEntity;

	@Column({ type: "varchar", length: 255 })
	title: string;

	@Column({ type: "text" })
	description: string;

	@Column({
		name: "thumbnail_file_id",
		type: "char",
		length: 36,
		charset: "utf8mb3",
		collation: "utf8mb3_general_ci",
		nullable: true
	})
	thumbnailFileId: string | null;

	@ManyToOne(() => LibraryFileEntity, { nullable: true })
	@JoinColumn({
		name: "thumbnail_file_id",
		foreignKeyConstraintName: "fk_notifications_thumbnail_file_id"
	})
	thumbnailFile: LibraryFileEntity | null;

	@Column({ name: "event_date", type: "datetime" })
	eventDate: Date;

	/** NULL means the push was not delivered to OneSignal (failed, or no subscribers). */
	@Column({ name: "onesignal_id", type: "varchar", length: 36, nullable: true })
	onesignalId: string | null;

	@CreateDateColumn({ name: "created_at", type: "timestamp" })
	createdAt: Date;

	@UpdateDateColumn({ name: "updated_at", type: "timestamp" })
	updatedAt: Date;
}
