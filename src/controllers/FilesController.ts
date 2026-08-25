import {
	Controller,
	HttpCode,
	HttpStatus,
	Post,
	Body,
	UploadedFile,
	UseInterceptors
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { CurrentUser } from "../commons/CurrentUser";
import { FileUploadResponse } from "../dtos/FileDto";
import { FilesService } from "../services/FilesService";

@Controller("files")
export class FilesController {
	constructor(private readonly filesService: FilesService) {}

	@Post()
	@HttpCode(HttpStatus.CREATED)
	@UseInterceptors(FileInterceptor("file"))
	async upload(
		@CurrentUser("id") userId: string,
		@UploadedFile() file?: Express.Multer.File,
		@Body("path") path: string = "/"
	): Promise<FileUploadResponse> {
		return this.filesService.upload(userId, file, path);
	}
}
