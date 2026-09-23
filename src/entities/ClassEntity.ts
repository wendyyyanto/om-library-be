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
import { ClassCategoryEntity } from "./ClassCategoryEntity";
import { LibraryUserEntity } from "./LibraryUserEntity";

@Entity({ name: "classes" })
@Index("idx_classes_class_category_id", ["classCategoryId"])
@Index("idx_classes_uploaded_by", ["uploadedBy"])
@Check("chk_classes_total_weeks", "total_weeks IS NULL OR total_weeks > 0")
export class ClassEntity {
	@PrimaryGeneratedColumn({ type: "int", unsigned: true })
	id: number;

	@Column({ type: "varchar", length: 255 })
	title: string;

	@Column({ type: "text", nullable: true })
	description: string | null;

	@Column({ name: "total_weeks", type: "int", unsigned: true, nullable: true })
	totalWeeks: number | null;

	@Column({ name: "class_category_id", type: "int", unsigned: true })
	classCategoryId: number;

	@ManyToOne(() => ClassCategoryEntity, {
		nullable: false,
		onUpdate: "RESTRICT",
		onDelete: "RESTRICT"
	})
	@JoinColumn({
		name: "class_category_id",
		foreignKeyConstraintName: "fk_classes_class_category"
	})
	category: ClassCategoryEntity;

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
		foreignKeyConstraintName: "fk_classes_uploaded_by"
	})
	uploader: LibraryUserEntity;

	@CreateDateColumn({ name: "created_at", type: "timestamp" })
	createdAt: Date;

	@UpdateDateColumn({ name: "updated_at", type: "timestamp" })
	updatedAt: Date;
}
