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
import { LibraryUserEntity } from "./LibraryUserEntity";

export enum TeachingCategory {
	NewTestament = "New Testament",
	OldTestament = "Old Testament",
	TopicalTeaching = "Topical Teaching",
	Workshop = "Workshop"
}

@Entity({ name: "teachings" })
@Index("fk_teachings_uploaded_by", ["uploadedBy"])
@Index("idx_teachings_audio_file_id", ["audioFileId"])
@Index("idx_teachings_pdf_file_id", ["pdfFileId"])
@Index("idx_teachings_ppt_file_id", ["pptFileId"])
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

	@Column({
		name: "audio_file_id",
		type: "char",
		length: 36,
		charset: "utf8mb3",
		collation: "utf8mb3_general_ci",
		nullable: true
	})
	audioFileId: string | null;

	@ManyToOne(() => LibraryFileEntity, {
		nullable: true,
		onDelete: "SET NULL"
	})
	@JoinColumn({
		name: "audio_file_id",
		foreignKeyConstraintName: "fk_teachings_audio_file"
	})
	audioFile: LibraryFileEntity | null;

	@Column({ name: "video_url", type: "text", nullable: true })
	videoUrl: string | null;

	@Column({
		name: "pdf_file_id",
		type: "char",
		length: 36,
		charset: "utf8mb3",
		collation: "utf8mb3_general_ci",
		nullable: true
	})
	pdfFileId: string | null;

	@ManyToOne(() => LibraryFileEntity, {
		nullable: true,
		onDelete: "SET NULL"
	})
	@JoinColumn({
		name: "pdf_file_id",
		foreignKeyConstraintName: "fk_teachings_pdf_file"
	})
	pdfFile: LibraryFileEntity | null;

	@Column({
		name: "ppt_file_id",
		type: "char",
		length: 36,
		charset: "utf8mb3",
		collation: "utf8mb3_general_ci",
		nullable: true
	})
	pptFileId: string | null;

	@ManyToOne(() => LibraryFileEntity, {
		nullable: true,
		onDelete: "SET NULL"
	})
	@JoinColumn({
		name: "ppt_file_id",
		foreignKeyConstraintName: "fk_teachings_ppt_file"
	})
	pptFile: LibraryFileEntity | null;

	@CreateDateColumn({ name: "created_at", type: "timestamp" })
	createdAt: Date;

	@UpdateDateColumn({ name: "updated_at", type: "timestamp" })
	updatedAt: Date;

	@Column({
		name: "uploaded_by",
		type: "char",
		length: 36,
		charset: "utf8mb3",
		collation: "utf8mb3_general_ci"
	})
	uploadedBy: string;

	@ManyToOne(() => LibraryUserEntity, { nullable: false })
	@JoinColumn({
		name: "uploaded_by",
		foreignKeyConstraintName: "fk_teachings_uploaded_by"
	})
	uploader: LibraryUserEntity;
}
