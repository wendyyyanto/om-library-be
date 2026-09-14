import {
	Check,
	Column,
	CreateDateColumn,
	Entity,
	Index,
	JoinColumn,
	ManyToOne,
	PrimaryGeneratedColumn,
	UpdateDateColumn
} from "typeorm";
import { LibraryFileEntity } from "./LibraryFileEntity";
import { LibraryUserEntity } from "./LibraryUserEntity";

@Entity({ name: "ebooks" })
@Index("idx_ebooks_cover_file_id", ["coverFileId"])
@Index("idx_ebooks_ebook_file_id", ["ebookFileId"])
@Index("idx_ebooks_uploaded_by", ["uploadedBy"])
@Check("chk_ebooks_total_pages", "total_pages IS NULL OR total_pages > 0")
export class EbookEntity {
	@PrimaryGeneratedColumn({ type: "int", unsigned: true })
	id: number;

	@Column({ type: "varchar", length: 255 })
	title: string;

	@Column({ type: "varchar", length: 255 })
	author: string;

	@Column({ type: "varchar", length: 35 })
	language: string;

	@Column({ name: "total_pages", type: "int", unsigned: true, nullable: true })
	totalPages: number | null;

	@Column({
		name: "cover_file_id",
		type: "char",
		length: 36,
		charset: "utf8mb3",
		collation: "utf8mb3_general_ci",
		nullable: true
	})
	coverFileId: string | null;

	@ManyToOne(() => LibraryFileEntity, {
		nullable: true,
		onUpdate: "RESTRICT",
		onDelete: "SET NULL"
	})
	@JoinColumn({
		name: "cover_file_id",
		foreignKeyConstraintName: "fk_ebooks_cover_file"
	})
	coverFile: LibraryFileEntity | null;

	@Column({
		name: "ebook_file_id",
		type: "char",
		length: 36,
		charset: "utf8mb3",
		collation: "utf8mb3_general_ci"
	})
	ebookFileId: string;

	@ManyToOne(() => LibraryFileEntity, {
		nullable: false,
		onUpdate: "RESTRICT",
		onDelete: "RESTRICT"
	})
	@JoinColumn({
		name: "ebook_file_id",
		foreignKeyConstraintName: "fk_ebooks_ebook_file"
	})
	ebookFile: LibraryFileEntity;

	@Column({ type: "text", nullable: true })
	overview: string | null;

	@Column({
		name: "uploaded_by",
		type: "char",
		length: 36,
		charset: "utf8mb3",
		collation: "utf8mb3_general_ci"
	})
	uploadedBy: string;

	@ManyToOne(() => LibraryUserEntity, {
		nullable: false,
		onUpdate: "RESTRICT",
		onDelete: "RESTRICT"
	})
	@JoinColumn({
		name: "uploaded_by",
		foreignKeyConstraintName: "fk_ebooks_uploaded_by"
	})
	uploader: LibraryUserEntity;

	@CreateDateColumn({ name: "created_at", type: "timestamp" })
	createdAt: Date;

	@UpdateDateColumn({ name: "updated_at", type: "timestamp" })
	updatedAt: Date;
}
