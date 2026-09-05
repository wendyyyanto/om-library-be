import {
	Column,
	CreateDateColumn,
	Entity,
	PrimaryColumn,
	UpdateDateColumn
} from "typeorm";

export enum TeachingCategory {
	NewTestament = "New Testament",
	OldTestament = "Old Testament",
	TopicalTeaching = "Topical Teaching",
	Workshop = "Workshop"
}

@Entity({ name: "teachings" })
export class TeachingEntity {
	@PrimaryColumn({ type: "char", length: 36, default: () => "uuid()" })
	id: string;

	@Column({ type: "varchar", length: 255 })
	title: string;

	@Column({ type: "varchar", length: 255 })
	passage: string;

	@Column({ type: "varchar", length: 255 })
	chapters: string;

	@Column({ type: "enum", enum: TeachingCategory })
	category: TeachingCategory;

	@Column({ type: "varchar", length: 32 })
	year: string;

	@Column({ type: "varchar", length: 255 })
	teacher: string;

	@Column({ type: "varchar", length: 255 })
	event: string;

	@Column({ name: "audio_url", type: "text", nullable: true })
	audioUrl: string | null;

	@Column({ name: "video_url", type: "text", nullable: true })
	videoUrl: string | null;

	@Column({ name: "pdf_url", type: "text", nullable: true })
	pdfUrl: string | null;

	@Column({ name: "ppt_url", type: "text", nullable: true })
	pptUrl: string | null;

	@CreateDateColumn({
		name: "created_at",
		type: "timestamp",
		default: () => "CURRENT_TIMESTAMP"
	})
	createdAt: Date;

	@UpdateDateColumn({
		name: "updated_at",
		type: "timestamp",
		default: () => "CURRENT_TIMESTAMP",
		onUpdate: "CURRENT_TIMESTAMP"
	})
	updatedAt: Date;

	@Column({
		name: "uploaded_by",
		type: "char",
		length: 36,
		charset: "utf8mb3",
		collation: "utf8mb3_general_ci"
	})
	uploadedBy: string;
}
