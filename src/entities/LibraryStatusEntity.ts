import {
	Column,
	CreateDateColumn,
	Entity,
	PrimaryGeneratedColumn
} from "typeorm";
import { UserStatus } from "../constants/library";

@Entity({ name: "library_statuses" })
export class LibraryStatusEntity {
	@PrimaryGeneratedColumn({ type: "int" })
	id: number;

	@Column({ type: "varchar", length: 45 })
	name: UserStatus;

	@CreateDateColumn({ name: "created_at", type: "timestamp" })
	createdAt: Date;
}
