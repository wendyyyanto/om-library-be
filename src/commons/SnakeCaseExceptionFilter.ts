import {
	ArgumentsHost,
	Catch,
	ExceptionFilter,
	HttpException,
	HttpStatus,
	Logger
} from "@nestjs/common";
import { Request, Response } from "express";
import { QueryFailedError } from "typeorm";
import { ERROR_CODES, ErrorCode } from "../constants/error-codes";

interface SnakeCaseErrorResponse {
	status_code: number;
	code: ErrorCode;
	message: string;
	errors?: string[];
}

@Catch()
export class SnakeCaseExceptionFilter implements ExceptionFilter {
	private readonly logger = new Logger(SnakeCaseExceptionFilter.name);

	catch(exception: unknown, host: ArgumentsHost): void {
		const http = host.switchToHttp();
		const request = http.getRequest<Request>();
		const response = http.getResponse<Response>();
		const databaseErrorMessage =
			request.method === "POST"
				? "The teaching could not be created."
				: "The teachings could not be retrieved.";

		if (exception instanceof QueryFailedError) {
			this.logger.error("A teachings database query failed.");
			response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
				status_code: HttpStatus.INTERNAL_SERVER_ERROR,
				code: ERROR_CODES.DATABASE_ERROR,
				message: databaseErrorMessage
			} satisfies SnakeCaseErrorResponse);
			return;
		}

		if (exception instanceof HttpException) {
			const status = exception.getStatus();
			const body = exception.getResponse();
			const source = this.isRecord(body) ? body : {};
			const errors = this.stringArray(source.errors);
			const result: SnakeCaseErrorResponse = {
				status_code: status,
				code: this.errorCode(source.code, status),
				message: this.message(source.message, body, status)
			};
			if (errors) result.errors = errors;

			response.status(status).json(result);
			return;
		}

		this.logger.error("An unhandled teachings endpoint error occurred.");
		response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
			status_code: HttpStatus.INTERNAL_SERVER_ERROR,
			code: ERROR_CODES.DATABASE_ERROR,
			message: databaseErrorMessage
		} satisfies SnakeCaseErrorResponse);
	}

	private isRecord(value: unknown): value is Record<string, unknown> {
		return typeof value === "object" && value !== null;
	}

	private stringArray(value: unknown): string[] | undefined {
		return Array.isArray(value) && value.every((item) => typeof item === "string")
			? value
			: undefined;
	}

	private errorCode(value: unknown, status: number): ErrorCode {
		if (
			typeof value === "string" &&
			(Object.values(ERROR_CODES) as string[]).includes(value)
		)
			return value as ErrorCode;

		switch (status) {
			case HttpStatus.BAD_REQUEST:
				return ERROR_CODES.VALIDATION_FAILED;
			case HttpStatus.UNAUTHORIZED:
				return ERROR_CODES.UNAUTHORIZED;
			case HttpStatus.FORBIDDEN:
				return ERROR_CODES.FORBIDDEN;
			case HttpStatus.NOT_FOUND:
				return ERROR_CODES.NOT_FOUND;
			default:
				return ERROR_CODES.DATABASE_ERROR;
		}
	}

	private message(source: unknown, body: unknown, status: number): string {
		if (
			status === HttpStatus.UNAUTHORIZED &&
			this.isRecord(body) &&
			body.code === ERROR_CODES.UNAUTHORIZED
		)
			return "Authentication is required.";
		if (typeof source === "string") return source;
		if (Array.isArray(source)) {
			const first = source.find((item) => typeof item === "string");
			if (typeof first === "string") return first;
		}
		if (typeof body === "string") return body;

		switch (status) {
			case HttpStatus.BAD_REQUEST:
				return "The request is invalid.";
			case HttpStatus.UNAUTHORIZED:
				return "Authentication is required.";
			case HttpStatus.FORBIDDEN:
				return "You do not have access to this feature.";
			case HttpStatus.NOT_FOUND:
				return "Resource not found.";
			default:
				return "The teachings could not be retrieved.";
		}
	}
}
