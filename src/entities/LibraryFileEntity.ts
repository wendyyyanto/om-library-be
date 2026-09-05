import {
	Column,
	CreateDateColumn,
	Entity,
	PrimaryColumn
} from "typeorm";

@Entity({ name: "library_files" })
export class LibraryFileEntity {
	@PrimaryColumn({ type: "char", length: 36 })
	id: string;

	@Column({ name: "uploaded_by", type: "char", length: 36 })
	uploadedBy: string;

	@Column({
		name: "storage_key",
		type: "varchar",
		length: 255,
		unique: true
	})
	storageKey: string;

	@Column({ name: "file_name", type: "varchar", length: 255 })
	fileName: string;

	@Column({ name: "content_type", type: "varchar", length: 255 })
	contentType: string;

	@Column({ name: "size_bytes", type: "bigint", unsigned: true })
	sizeBytes: number;

	@CreateDateColumn({ name: "created_at", type: "timestamp" })
	createdAt: Date;

	@Column({ name: "deleted_at", type: "timestamp", nullable: true })
	deletedAt: Date | null;
}
