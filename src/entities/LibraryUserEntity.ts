import { Column, CreateDateColumn, Entity, PrimaryColumn } from "typeorm";
import {
	ROLE_IDS,
	USER_STATUS_IDS,
	UserRole,
	UserStatus
} from "../constants/library";

@Entity({ name: "library_users" })
export class LibraryUserEntity {
	@PrimaryColumn({ type: "char", length: 36 })
	id: string;

	@Column({ type: "text" })
	name: string;

	@Column({ type: "varchar", length: 255 })
	email: string;

	@Column({ name: "password_hash", type: "varchar", length: 255 })
	passwordHash: string;

	@Column({
		name: "role_id",
		type: "int",
		default: ROLE_IDS[UserRole.Member]
	})
	roleId: number;

	@Column({
		name: "status_id",
		type: "int",
		default: USER_STATUS_IDS[UserStatus.Active]
	})
	statusId: number;

	@CreateDateColumn({ name: "created_at", type: "timestamp" })
	createdAt: Date;

	@Column({ name: "tokens_valid_from", type: "timestamp" })
	tokensValidFrom: Date;
}
