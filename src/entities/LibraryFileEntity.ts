import {
	Column,
	CreateDateColumn,
	Entity,
	Index,
	JoinColumn,
	ManyToOne,
	PrimaryColumn
} from "typeorm";
import { LibraryUserEntity } from "./LibraryUserEntity";

@Entity({ name: "library_files" })
@Index("uq_library_files_storage_key", ["storageKey"], { unique: true })
@Index("idx_library_files_uploaded_by", ["uploadedBy"])
export class LibraryFileEntity {
	@PrimaryColumn({ type: "char", length: 36 })
	id: string;

	@Column({ name: "uploaded_by", type: "char", length: 36 })
	uploadedBy: string;

	@ManyToOne(() => LibraryUserEntity, { nullable: false })
	@JoinColumn({
		name: "uploaded_by",
		foreignKeyConstraintName: "fk_library_files_uploaded_by"
	})
	uploader: LibraryUserEntity;

	@Column({ name: "storage_key", type: "text" })
	storageKey: string;

	@Column({ name: "file_name", type: "text" })
	fileName: string;

	@Column({ type: "text", nullable: true })
	url: string | null;

	@Column({ name: "content_type", type: "varchar", length: 255 })
	contentType: string;

	@Column({
		name: "size_bytes",
		type: "bigint",
		unsigned: true,
		nullable: true
	})
	sizeBytes: number | null;

	@CreateDateColumn({ name: "created_at", type: "timestamp" })
	createdAt: Date;

	@Column({ name: "deleted_at", type: "timestamp", nullable: true })
	deletedAt: Date | null;
}
