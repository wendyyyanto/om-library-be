import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SnakeCaseExceptionFilter } from "../commons/SnakeCaseExceptionFilter";
import { TeachingsController } from "../controllers/TeachingsController";
import { TeachingEntity } from "../entities/TeachingEntity";
import { LibraryFileEntity } from "../entities/LibraryFileEntity";
import { TeachingsService } from "../services/TeachingsService";
import { FilesModule } from "./FilesModule";

@Module({
	imports: [
		TypeOrmModule.forFeature([TeachingEntity, LibraryFileEntity]),
		FilesModule
	],
	controllers: [TeachingsController],
	providers: [TeachingsService, SnakeCaseExceptionFilter]
})
export class TeachingsModule {}
