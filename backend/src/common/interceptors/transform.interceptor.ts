import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';

export interface PaginationMeta {
  page?: number;
  pageSize?: number;
  total?: number;
  totalPages?: number;
}

export interface SuccessEnvelope<T> {
  success: true;
  data: T;
  meta?: PaginationMeta;
}

interface MaybePaginated<T> {
  data?: T;
  meta?: PaginationMeta;
  // Anything else is folded into `data`.
  [key: string]: unknown;
}

/**
 * Wraps every successful controller response in:
 *   { success: true, data: <body>, meta?: {...} }
 *
 * Controllers/services that need to attach pagination should return
 * `{ data, meta }` directly. Otherwise the entire return value becomes `data`.
 */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, SuccessEnvelope<T>> {
  intercept(_ctx: ExecutionContext, next: CallHandler<T>): Observable<SuccessEnvelope<T>> {
    return next.handle().pipe(
      map((value) => {
        if (this.isPaginated(value)) {
          const v = value as MaybePaginated<T>;
          return { success: true, data: v.data as T, meta: v.meta };
        }
        return { success: true, data: value as T };
      }),
    );
  }

  private isPaginated(value: unknown): value is { data: unknown; meta: PaginationMeta } {
    return (
      typeof value === 'object' &&
      value !== null &&
      'data' in value &&
      'meta' in value &&
      typeof (value as { meta?: unknown }).meta === 'object'
    );
  }
}
