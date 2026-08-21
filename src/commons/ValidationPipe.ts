import { BadRequestException, ValidationError, ValidationPipe } from '@nestjs/common';
import { ApiErrorBody, ERROR_CODES } from '../constants/error-codes';

/** {@link ApiErrorBody} plus the per-field detail a 400 can usefully carry. */
export interface ValidationErrorBody extends ApiErrorBody {
  errors: string[];
}

/**
 * Constraints that describe *what a field is* outrank ones that describe how big it may be.
 * class-validator evaluates decorators bottom-up, so a missing `email` reports both
 * `maxLength` and `isEmail` with the length failure first — "Email terlalu panjang." is a
 * baffling thing to tell someone who sent no email at all. Ranking here keeps the DTO's
 * decorator order natural.
 */
const CONSTRAINT_RANK: Record<string, number> = {
  isDefined: 0,
  isNotEmpty: 0,
  isString: 0,
  isInt: 0,
  isEmail: 1,
  minLength: 2,
  maxLength: 3,
};

function rank(constraint: string): number {
  return CONSTRAINT_RANK[constraint] ?? 4;
}

/** Depth-first flatten — `ValidationError` nests for object and array properties. */
function collectMessages(errors: ValidationError[]): string[] {
  return errors.flatMap((error) => [
    ...Object.entries(error.constraints ?? {})
      .sort(([a], [b]) => rank(a) - rank(b))
      .map(([, message]) => message),
    ...collectMessages(error.children ?? []),
  ]);
}

/**
 * The global request-body validator, registered as an `APP_PIPE` in `AppModule`.
 *
 * `whitelist` strips properties with no decorator and `forbidNonWhitelisted` turns them into
 * a 400. That pairing is what keeps BR-5 airtight: a `role` in a register body is rejected
 * rather than quietly dropped, so an attempt to self-promote is visible instead of silent.
 *
 * Failures are rendered in the same `{ statusCode, code, message }` envelope as every other
 * library error (API.md §11) so the Flutter client has one parse path — with `errors`
 * carrying the individual field messages.
 */
export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: false },
    exceptionFactory: (errors: ValidationError[]) => {
      const messages = collectMessages(errors);
      const body: ValidationErrorBody = {
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_FAILED,
        message: messages[0] ?? 'Data yang dikirim tidak valid.',
        errors: messages,
      };
      return new BadRequestException(body);
    },
  });
}
