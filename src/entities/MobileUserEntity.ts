import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

export enum MobileApprovalStatus {
	Pending = 0,
	Approved = 1,
	Rejected = 2
}

/** Mobile app accounts (`Platform: Mobile`). Separate from `library_users`. */
@Entity({ name: "users" })
export class MobileUserEntity {
	@PrimaryGeneratedColumn()
	id: number;

	@Column({ type: "varchar", length: 255, nullable: true })
	name: string | null;

	@Column({ type: "varchar", length: 255 })
	email: string;

	@Column({ name: "approval_status", type: "tinyint", default: MobileApprovalStatus.Pending })
	approvalStatus: MobileApprovalStatus;

	/** The JWT from the last login link; a link is only valid while it matches this. */
	@Column({ type: "text", nullable: true })
	token: string | null;
}
