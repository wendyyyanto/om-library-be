import {
	Column,
	Entity,
	Index,
	JoinColumn,
	ManyToOne,
	PrimaryColumn
} from "typeorm";
import { LibraryUserEntity } from "./LibraryUserEntity";

@Entity({ name: "library_auth_sessions" })
@Index("idx_library_auth_sessions_user_id", ["userId"])
export class AuthSessionEntity {
	@PrimaryColumn({ type: "char", length: 36 })
	id: string;

	@Column({ name: "user_id", type: "char", length: 36 })
	userId: string;

	@ManyToOne(() => LibraryUserEntity, { nullable: false, onDelete: "CASCADE" })
	@JoinColumn({
		name: "user_id",
		foreignKeyConstraintName: "fk_library_auth_sessions_user_id"
	})
	user: LibraryUserEntity;

	@Column({ name: "refresh_token_hash", type: "binary", length: 32 })
	refreshTokenHash: Buffer;

	@Column({ name: "expires_at", type: "timestamp" })
	expiresAt: Date;
}
