import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { EbookController } from "../controllers/EbookController";
import { EbookEntity } from "../entities/EbookEntity";
import { EbookTagEntity } from "../entities/EbookTagEntity";
import { EbookTagLinkEntity } from "../entities/EbookTagLinkEntity";
import { LibraryFileEntity } from "../entities/LibraryFileEntity";
import { EbookService } from "../services/EbookService";
import { FilesModule } from "./FilesModule";

@Module({
	imports: [
		TypeOrmModule.forFeature([
			EbookEntity,
			EbookTagEntity,
			EbookTagLinkEntity,
			LibraryFileEntity
		]),
		FilesModule
	],
	controllers: [EbookController],
	providers: [EbookService]
})
export class EbookModule {}
