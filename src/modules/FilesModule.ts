import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { MulterModule } from "@nestjs/platform-express";
import { TypeOrmModule } from "@nestjs/typeorm";
import { FilesController } from "../controllers/FilesController";
import { LibraryFileEntity } from "../entities/LibraryFileEntity";
import { TeachingEntity } from "../entities/TeachingEntity";
import { FilesService, fileUploadMaxBytes } from "../services/FilesService";

@Module({
	imports: [
		TypeOrmModule.forFeature([LibraryFileEntity, TeachingEntity]),
		MulterModule.registerAsync({
			inject: [ConfigService],
			useFactory: (config: ConfigService) => ({
				limits: {
					fileSize: fileUploadMaxBytes(config),
					files: 1
				}
			})
		})
	],
	controllers: [FilesController],
	providers: [FilesService],
	exports: [FilesService]
})
export class FilesModule {}
