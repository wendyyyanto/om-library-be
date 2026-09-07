import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import { Response } from 'express';
import { QueryFailedError } from 'typeorm';
import { ApiErrorBody, ERROR_CODES, ErrorCode, MYSQL_ERROR } from '../constants/error-codes';

interface DriverError {
  errno?: number;
  code?: string;
  sqlMessage?: string;
}

/**
 * Maps a violated unique index onto a domain-specific code. Without this every 1062 would
 * collapse into a generic DUPLICATE_ENTRY, and services would have to pre-`SELECT` to tell
 * the cases apart — which is exactly the race the unique indexes exist to close.
 */
const UNIQUE_INDEX_CODES: Array<{ pattern: RegExp; code: ErrorCode; message: string }> = [
  { pattern: /uq_lending_pending/i, code: ERROR_CODES.DUPLICATE_REQUEST, message: 'Kamu sudah punya permintaan yang menunggu untuk buku ini.' },
  // Anchored on the `for key '...'` clause, not the message as a whole: MariaDB 10.11 names
  // the index bare (`for key 'email'`) while MySQL 8 qualifies it (`for key
  // 'library_users.email'`), and an unanchored /email/ would also match any duplicate *value*
  // that happens to contain the word.
  { pattern: /for key '(?:[\w$]+\.)?(?:uq_users_email|email)'/i, code: ERROR_CODES.EMAIL_TAKEN, message: 'Email sudah terdaftar.' },
  { pattern: /uq_copy_code/i, code: ERROR_CODES.DUPLICATE_ENTRY, message: 'Kode salinan sudah dipakai untuk buku ini.' },
];

/**
 * Translates MySQL driver errors into the stable `{ statusCode, code, message }` shape so
 * raw driver text never reaches a user.
 *
 * Scoped to `QueryFailedError` on purpose: the pre-existing OM endpoints already catch their
 * own database failures, so this filter only sees query errors that escaped a service.
 * Deadlocks are retried in {@link TransactionRunner}; by the time one arrives here the
 * retries are spent, so it becomes a 503.
 */
@Catch(QueryFailedError)
export class MysqlExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(MysqlExceptionFilter.name);

  catch(exception: QueryFailedError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const driver = exception.driverError as DriverError | undefined;
    const body = this.translate(driver);

    this.logger.error(`MySQL ${driver?.errno ?? '?'} (${driver?.code ?? 'UNKNOWN'}) -> ${body.statusCode} ${body.code}: ${driver?.sqlMessage ?? exception.message}`);

    response.status(body.statusCode).json(body);
  }

  private translate(driver: DriverError | undefined): ApiErrorBody {
    const detail = driver?.sqlMessage ?? '';

    switch (driver?.errno) {
      case MYSQL_ERROR.DUP_ENTRY: {
        const match = UNIQUE_INDEX_CODES.find((entry) => entry.pattern.test(detail));
        return {
          statusCode: HttpStatus.CONFLICT,
          code: match?.code ?? ERROR_CODES.DUPLICATE_ENTRY,
          message: match?.message ?? 'Data sudah ada.',
        };
      }
      case MYSQL_ERROR.NO_REFERENCED_ROW:
      case MYSQL_ERROR.ROW_IS_REFERENCED:
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          code: ERROR_CODES.INVALID_REFERENCE,
          message: 'Data yang dirujuk tidak valid.',
        };
      case MYSQL_ERROR.CHECK_CONSTRAINT:
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          code: ERROR_CODES.VALIDATION_FAILED,
          message: 'Data tidak memenuhi aturan yang berlaku.',
        };
      case MYSQL_ERROR.LOCK_DEADLOCK:
      case MYSQL_ERROR.LOCK_WAIT_TIMEOUT:
        return {
          statusCode: HttpStatus.SERVICE_UNAVAILABLE,
          code: ERROR_CODES.DATABASE_BUSY,
          message: 'Server sedang sibuk. Coba lagi sebentar lagi.',
        };
      default:
        return {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          code: ERROR_CODES.DATABASE_ERROR,
          message: 'Terjadi kesalahan pada server.',
        };
    }
  }
}
