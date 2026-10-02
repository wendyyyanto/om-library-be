import {
	Column,
	CreateDateColumn,
	DeleteDateColumn,
	Entity,
	PrimaryColumn,
	UpdateDateColumn
} from "typeorm";

export enum MobileApprovalStatus {
	Pending = 0,
	Approved = 1,
	Rejected = 2
}

/** Mobile app accounts (`Platform: Mobile`). Separate from `library_users`. */
@Entity({ name: "users" })
export class MobileUserEntity {
	/** UUID v4, generated in the app: MariaDB 10.11's `UUID()` is v1. */
	@PrimaryColumn({ type: "char", length: 36 })
	id: string;

	@Column({ type: "varchar", length: 255, nullable: true })
	name: string | null;

	@Column({ type: "varchar", length: 255 })
	email: string;

	@Column({ name: "approval_status", type: "tinyint", default: MobileApprovalStatus.Pending })
	approvalStatus: MobileApprovalStatus;

	/** The JWT from the last login link; a link is only valid while it matches this. */
	@Column({ type: "text", nullable: true })
	token: string | null;

	/** Day an admin approved the account (`YYYY-MM-DD`); null while pending or rejected. */
	@Column({ name: "joined_at", type: "date", nullable: true })
	joinedAt: string | null;

	@CreateDateColumn({ name: "created_at", type: "timestamp" })
	createdAt: Date;

	@UpdateDateColumn({ name: "updated_at", type: "timestamp" })
	updatedAt: Date;

	/** Soft delete: TypeORM's find/exists skip rows where this is set. */
	@DeleteDateColumn({ name: "deleted_at", type: "timestamp", nullable: true })
	deletedAt: Date | null;
}
