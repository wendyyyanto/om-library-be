import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity({ name: "thumbnails" })
export class ThumbnailEntity {
	@PrimaryColumn({ type: "char", length: 36, default: () => "uuid()" })
	id: string;

	@Column({ name: "bookName", type: "varchar", length: 255, nullable: true })
	bookName: string | null;

	@Column({ name: "thumbnailUrl", type: "text", nullable: true })
	thumbnailUrl: string | null;

	@Column({ name: "createdAt", type: "datetime", nullable: true })
	createdAt: Date | null;
}
