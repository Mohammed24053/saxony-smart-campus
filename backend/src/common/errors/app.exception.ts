import { HttpException } from '@nestjs/common';
import { ErrorCode, errorHttpStatus, errorMessages } from './error-codes';

export interface AppExceptionDetails {
  message?: string;
  details?: Record<string, unknown>;
}

/**
 * The single exception every domain service should throw. The HTTP filter
 * unwraps it into the standard `{ success:false, error:{ code, message } }`
 * envelope.
 */
export class AppException extends HttpException {
  readonly code: ErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: ErrorCode, opts: AppExceptionDetails = {}) {
    const status = errorHttpStatus[code] ?? 500;
    const message = opts.message ?? errorMessages[code] ?? 'Internal server error';
    super({ code, message, details: opts.details }, status);
    this.code = code;
    this.details = opts.details;
  }
}
