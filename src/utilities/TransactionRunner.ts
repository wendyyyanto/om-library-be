import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, QueryFailedError } from 'typeorm';
import { RETRYABLE_MYSQL_ERRORS } from '../constants/error-codes';

const MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 50;

/**
 * The single transaction helper for the library flows. Everything that needs `FOR UPDATE`
 * (borrow request, approve, confirm-return) goes through here so retry behaviour lives in
 * one place.
 *
 * A deadlock (1213) or lock-wait timeout (1205) rolls the whole transaction back, so
 * replaying the callback is safe — the previous attempt left nothing behind. Once the
 * attempts are spent the error escapes to {@link MysqlExceptionFilter}, which turns it
 * into a 503.
 */
@Injectable()
export class TransactionRunner {
  private readonly logger = new Logger(TransactionRunner.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async run<T>(work: (manager: EntityManager) => Promise<T>): Promise<T> {
    for (let attempt = 1; ; attempt += 1) {
      try {
        return await this.dataSource.transaction((manager) => work(manager));
      } catch (error) {
        if (attempt >= MAX_ATTEMPTS || !this.isRetryable(error)) throw error;
        this.logger.warn(`Transaction attempt ${attempt}/${MAX_ATTEMPTS} hit a lock conflict, retrying`);
        await this.delay(BASE_BACKOFF_MS * attempt);
      }
    }
  }

  private isRetryable(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) return false;
    const errno = (error.driverError as { errno?: number } | undefined)?.errno;
    return errno !== undefined && RETRYABLE_MYSQL_ERRORS.includes(errno);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
