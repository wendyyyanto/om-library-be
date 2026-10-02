import {
	Column,
	CreateDateColumn,
	Entity,
	PrimaryGeneratedColumn,
	UpdateDateColumn
} from "typeorm";

/** `name` is sent to OneSignal as-is, so it must match a dashboard segment exactly. */
@Entity({ name: "notification_segments" })
export class NotificationSegmentEntity {
	@PrimaryGeneratedColumn({ type: "int", unsigned: true })
	id: number;

	@Column({ type: "varchar", length: 100, unique: true })
	name: string;

	@CreateDateColumn({ name: "created_at", type: "timestamp" })
	createdAt: Date;

	@UpdateDateColumn({ name: "updated_at", type: "timestamp" })
	updatedAt: Date;
}
