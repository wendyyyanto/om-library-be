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
	CompleteUploadDto,
	CreateUploadUrlDto,
	DeleteFileDto,
	FileUploadResponse,
	LegacyFileUploadResponse,
	UploadFileDto,
	UploadUrlResponse
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
	): Promise<LegacyFileUploadResponse> {
		return this.filesService.upload(userId, file, dto.path || "files");
	}

	@Post("upload-url")
	@HttpCode(HttpStatus.OK)
	async createUploadUrl(
		@CurrentUser("id") userId: string,
		@Body() dto: CreateUploadUrlDto
	): Promise<UploadUrlResponse> {
		return this.filesService.createUploadUrl(userId, dto);
	}

	@Post("complete")
	@HttpCode(HttpStatus.CREATED)
	async completeUpload(
		@CurrentUser("id") userId: string,
		@Body() dto: CompleteUploadDto
	): Promise<FileUploadResponse> {
		return this.filesService.completeUpload(userId, dto.upload_token);
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
