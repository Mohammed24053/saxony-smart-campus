import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Request } from 'express';
import { Observable, tap } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request & { id?: string }>();
    const startedAt = Date.now();
    const { method, originalUrl } = req;
    const reqId = req.id ?? '-';
    return next.handle().pipe(
      tap({
        next: () =>
          this.logger.log(`[${reqId}] ${method} ${originalUrl} ${Date.now() - startedAt}ms`),
        error: (err) =>
          this.logger.warn(
            `[${reqId}] ${method} ${originalUrl} ${Date.now() - startedAt}ms — ${(err as Error)?.message ?? err}`,
          ),
      }),
    );
  }
}
