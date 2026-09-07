import {
	Column,
	CreateDateColumn,
	Entity,
	PrimaryGeneratedColumn
} from "typeorm";
import { UserRole } from "../constants/library";

@Entity({ name: "library_roles" })
export class LibraryRoleEntity {
	@PrimaryGeneratedColumn({ type: "int" })
	id: number;

	@Column({ type: "varchar", length: 45 })
	name: UserRole;

	@CreateDateColumn({ name: "created_at", type: "timestamp" })
	createdAt: Date;
}
