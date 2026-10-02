import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { NotificationController } from "../controllers/NotificationController";
import { LibraryFileEntity } from "../entities/LibraryFileEntity";
import { NotificationEntity } from "../entities/NotificationEntity";
import { NotificationSegmentEntity } from "../entities/NotificationSegmentEntity";
import { NotificationService } from "../services/NotificationService";
import { FilesModule } from "./FilesModule";

@Module({
	imports: [
		TypeOrmModule.forFeature([
			NotificationEntity,
			NotificationSegmentEntity,
			LibraryFileEntity
		]),
		FilesModule
	],
	controllers: [NotificationController],
	providers: [NotificationService]
})
export class NotificationModule {}
