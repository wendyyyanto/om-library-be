import {
	CreateDateColumn,
	Entity,
	Index,
	JoinColumn,
	ManyToOne,
	PrimaryColumn
} from "typeorm";
import { ClassMaterialEntity } from "./ClassMaterialEntity";
import { LibraryFileEntity } from "./LibraryFileEntity";

@Entity({ name: "class_material_files" })
@Index("idx_class_material_files_file_id", ["fileId"])
export class ClassMaterialFileEntity {
	@PrimaryColumn({ name: "material_id", type: "int", unsigned: true })
	materialId: number;

	@ManyToOne(() => ClassMaterialEntity, {
		nullable: false,
		onUpdate: "RESTRICT",
		onDelete: "CASCADE"
	})
	@JoinColumn({
		name: "material_id",
		foreignKeyConstraintName: "fk_class_material_files_material"
	})
	material: ClassMaterialEntity;

	@PrimaryColumn({
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
		foreignKeyConstraintName: "fk_class_material_files_file"
	})
	file: LibraryFileEntity;

	@CreateDateColumn({ name: "created_at", type: "timestamp" })
	createdAt: Date;
}
