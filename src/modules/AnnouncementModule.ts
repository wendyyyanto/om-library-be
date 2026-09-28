import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AnnouncementController } from "../controllers/AnnouncementController";
import { AnnouncementEntity } from "../entities/AnnouncementEntity";
import { AnnouncementService } from "../services/AnnouncementService";

@Module({
	imports: [TypeOrmModule.forFeature([AnnouncementEntity])],
	controllers: [AnnouncementController],
	providers: [AnnouncementService]
})
export class AnnouncementModule {}
