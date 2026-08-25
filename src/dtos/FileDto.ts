export interface FileUploadResponse {
	key: string;
	etag: string | null;
	size: number;
	contentType: string;
	originalName: string;
}
