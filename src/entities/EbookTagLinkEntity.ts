import { Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm";
import { EbookEntity } from "./EbookEntity";
import { EbookTagEntity } from "./EbookTagEntity";

@Entity({ name: "ebook_tag_links" })
@Index("idx_ebook_tag_links_tag_id", ["tagId"])
export class EbookTagLinkEntity {
	@PrimaryColumn({
		name: "ebook_id",
		type: "char",
		length: 36,
		charset: "utf8mb3",
		collation: "utf8mb3_general_ci"
	})
	ebookId: string;

	@ManyToOne(() => EbookEntity, {
		nullable: false,
		onUpdate: "RESTRICT",
		onDelete: "CASCADE"
	})
	@JoinColumn({
		name: "ebook_id",
		foreignKeyConstraintName: "fk_ebook_tag_links_ebook"
	})
	ebook: EbookEntity;

	@PrimaryColumn({ name: "tag_id", type: "int", unsigned: true })
	tagId: number;

	@ManyToOne(() => EbookTagEntity, {
		nullable: false,
		onUpdate: "RESTRICT",
		onDelete: "CASCADE"
	})
	@JoinColumn({
		name: "tag_id",
		foreignKeyConstraintName: "fk_ebook_tag_links_tag"
	})
	tag: EbookTagEntity;
}
