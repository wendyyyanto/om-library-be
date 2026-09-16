import {
	Column,
	CreateDateColumn,
	Entity,
	Index,
	PrimaryGeneratedColumn,
	UpdateDateColumn
} from "typeorm";

@Entity({ name: "ebook_tags" })
@Index("uq_ebook_tags_label", ["label"], { unique: true })
export class EbookTagEntity {
	@PrimaryGeneratedColumn({ type: "int", unsigned: true })
	id: number;

	@Column({ type: "varchar", length: 64 })
	label: string;

	@CreateDateColumn({ name: "created_at", type: "timestamp" })
	createdAt: Date;

	@UpdateDateColumn({ name: "updated_at", type: "timestamp" })
	updatedAt: Date;
}
