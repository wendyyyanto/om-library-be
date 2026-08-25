import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { MulterModule } from "@nestjs/platform-express";
import { FilesController } from "../controllers/FilesController";
import { FilesService } from "../services/FilesService";

const DEFAULT_FILE_UPLOAD_MAX_BYTES = 10 * 1024 * 1024;

@Module({
	imports: [
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
	providers: [FilesService]
})
export class FilesModule {}

function fileUploadMaxBytes(config: ConfigService): number {
	const raw = config.get<string>("FILE_UPLOAD_MAX_BYTES");
	if (raw === undefined) return DEFAULT_FILE_UPLOAD_MAX_BYTES;

	const value = Number(raw);
	if (!Number.isSafeInteger(value) || value <= 0)
		throw new Error(
			"FILE_UPLOAD_MAX_BYTES must be a positive whole number of bytes"
		);
	return value;
}
