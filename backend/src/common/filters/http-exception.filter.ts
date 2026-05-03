import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AppException } from '../errors/app.exception';
import { ErrorCodes, errorMessages } from '../errors/error-codes';

interface ErrorEnvelope {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * Wraps every thrown error into the canonical envelope:
 *   { success: false, error: { code, message, details? } }
 *
 * Order of unwrapping:
 *   1. AppException → use its `.code` and `.message` directly.
 *   2. HttpException with class-validator payload → VALIDATION_ERROR.
 *   3. Generic HttpException → derive a code from the status.
 *   4. Anything else → INTERNAL_ERROR (and log the stack).
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, body } = this.unwrap(exception);

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} → ${status} ${body.error.code}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.debug(`${request.method} ${request.url} → ${status} ${body.error.code}`);
    }

    response.status(status).json(body);
  }

  private unwrap(exception: unknown): { status: number; body: ErrorEnvelope } {
    if (exception instanceof AppException) {
      return {
        status: exception.getStatus(),
        body: {
          success: false,
          error: {
            code: exception.code,
            message: exception.message,
            details: exception.details,
          },
        },
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const raw = exception.getResponse();
      const { code, message, details } = this.deriveFromHttpException(status, raw);
      return { status, body: { success: false, error: { code, message, details } } };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        success: false,
        error: {
          code: ErrorCodes.INTERNAL_ERROR,
          message: errorMessages[ErrorCodes.INTERNAL_ERROR],
        },
      },
    };
  }

  private deriveFromHttpException(
    status: number,
    raw: string | object,
  ): { code: string; message: string; details?: unknown } {
    let message = typeof raw === 'string' ? raw : (raw as { message?: unknown }).message?.toString?.() ?? '';
    let details: unknown;

    // class-validator returns { statusCode, message: string[], error }
    if (typeof raw === 'object' && raw !== null) {
      const obj = raw as { message?: unknown; error?: unknown };
      if (Array.isArray(obj.message)) {
        details = { errors: obj.message };
        message = 'Request validation failed';
        return { code: ErrorCodes.VALIDATION_ERROR, message, details };
      }
      if (typeof obj.message === 'string') message = obj.message;
    }

    const code = this.statusToCode(status);
    return { code, message: message || errorMessages[code as keyof typeof errorMessages] || 'Error', details };
  }

  private statusToCode(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return ErrorCodes.VALIDATION_ERROR;
      case HttpStatus.UNAUTHORIZED:
        return ErrorCodes.UNAUTHORIZED;
      case HttpStatus.FORBIDDEN:
        return ErrorCodes.FORBIDDEN;
      case HttpStatus.NOT_FOUND:
        return ErrorCodes.NOT_FOUND;
      case HttpStatus.CONFLICT:
        return ErrorCodes.CONFLICT;
      case HttpStatus.TOO_MANY_REQUESTS:
        return ErrorCodes.RATE_LIMITED;
      default:
        return ErrorCodes.INTERNAL_ERROR;
    }
  }
}
