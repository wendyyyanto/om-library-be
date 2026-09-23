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
import { ClassEntity } from "./ClassEntity";
import { LibraryFileEntity } from "./LibraryFileEntity";

@Entity({ name: "class_materials" })
@Index("idx_class_materials_class_week", ["classId", "weekNumber"])
@Index("idx_class_materials_file_id", ["fileId"])
@Check(
	"chk_class_materials_week_number",
	"week_number IS NULL OR week_number > 0"
)
export class ClassMaterialEntity {
	@PrimaryGeneratedColumn({ type: "int", unsigned: true })
	id: number;

	@Column({ name: "class_id", type: "int", unsigned: true })
	classId: number;

	@ManyToOne(() => ClassEntity, {
		nullable: false,
		onUpdate: "RESTRICT",
		onDelete: "CASCADE"
	})
	@JoinColumn({
		name: "class_id",
		foreignKeyConstraintName: "fk_class_materials_class"
	})
	class: ClassEntity;

	@Column({ type: "varchar", length: 255 })
	title: string;

	@Column({ name: "week_number", type: "int", unsigned: true, nullable: true })
	weekNumber: number | null;

	@Column({
		name: "file_id",
		type: "char",
		length: 36,
		charset: "utf8mb3",
		collation: "utf8mb3_general_ci"
	})
	fileId: string;

	@ManyToOne(() => LibraryFileEntity, {
		nullable: false,
		onUpdate: "RESTRICT",
		onDelete: "RESTRICT"
	})
	@JoinColumn({
		name: "file_id",
		foreignKeyConstraintName: "fk_class_materials_file"
	})
	file: LibraryFileEntity;

	@CreateDateColumn({ name: "created_at", type: "timestamp" })
	createdAt: Date;

	@UpdateDateColumn({ name: "updated_at", type: "timestamp" })
	updatedAt: Date;
}
