import {
	Controller,
	Delete,
	HttpCode,
	HttpStatus,
	Post,
	Body,
	UploadedFile,
	UseInterceptors
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { CurrentUser } from "../commons/CurrentUser";
import {
	DeleteFileDto,
	FileUploadResponse,
	UploadFileDto
} from "../dtos/FileDto";
import { FilesService } from "../services/FilesService";

@Controller("files")
export class FilesController {
	constructor(private readonly filesService: FilesService) {}

	@Post()
	@HttpCode(HttpStatus.CREATED)
	@UseInterceptors(FileInterceptor("file"))
	async upload(
		@CurrentUser("id") userId: string,
		@UploadedFile() file: Express.Multer.File | undefined,
		@Body() dto: UploadFileDto
	): Promise<FileUploadResponse> {
		return this.filesService.upload(userId, file, dto.path || "files");
	}

	@Delete()
	@HttpCode(HttpStatus.NO_CONTENT)
	async delete(
		@CurrentUser("id") userId: string,
		@Body() dto: DeleteFileDto
	): Promise<void> {
		return this.filesService.delete(userId, dto.file_id);
	}
}
