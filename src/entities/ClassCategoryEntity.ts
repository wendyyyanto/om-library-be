import {
	Column,
	CreateDateColumn,
	Entity,
	Index,
	PrimaryGeneratedColumn,
	UpdateDateColumn
} from "typeorm";

@Entity({ name: "class_categories" })
@Index("uq_class_categories_label", ["label"], { unique: true })
export class ClassCategoryEntity {
	@PrimaryGeneratedColumn({ type: "int", unsigned: true })
	id: number;

	@Column({ type: "varchar", length: 64 })
	label: string;

	@CreateDateColumn({ name: "created_at", type: "timestamp" })
	createdAt: Date;

	@UpdateDateColumn({ name: "updated_at", type: "timestamp" })
	updatedAt: Date;
}
