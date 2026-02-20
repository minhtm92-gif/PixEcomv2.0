import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

/**
 * TimingInterceptor — WS5 (Milestone 2.3.7)
 *
 * For every request:
 *  1. Records start time
 *  2. On response: computes durationMs
 *  3. Sets `X-Response-Time-Ms` response header
 *  4. Emits structured log with route/method/status/durationMs
 *  5. If durationMs > SLOW_REQUEST_THRESHOLD_MS (default 1000), emits WARN
 *
 * No request/response body is logged — only metadata.
 */
@Injectable()
export class TimingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(TimingInterceptor.name);
  private readonly slowThreshold: number;

  constructor() {
    this.slowThreshold = parseInt(
      process.env.SLOW_REQUEST_THRESHOLD_MS ?? '1000',
      10,
    );
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http      = context.switchToHttp();
    const req       = http.getRequest<Request & { requestId?: string }>();
    const res       = http.getResponse<Response>();
    const startedAt = Date.now();

    return next.handle().pipe(
      tap({
        next: () => this.finish(req, res, startedAt),
        error: () => this.finish(req, res, startedAt),
      }),
    );
  }

  private finish(
    req: Request & { requestId?: string },
    res: Response,
    startedAt: number,
  ): void {
    const durationMs  = Date.now() - startedAt;
    const statusCode  = res.statusCode;
    const method      = req.method;
    const route       = req.path;
    const requestId   = req.requestId;

    res.setHeader('X-Response-Time-Ms', String(durationMs));

    const entry = {
      msg: `${method} ${route} ${statusCode} ${durationMs}ms`,
      requestId,
      method,
      route,
      statusCode,
      durationMs,
    };

    if (durationMs > this.slowThreshold) {
      this.logger.warn(
        `SLOW REQUEST: ${method} ${route} took ${durationMs}ms (threshold: ${this.slowThreshold}ms)`,
        JSON.stringify({ requestId, route, method, durationMs, statusCode }),
      );
    } else {
      this.logger.log(entry.msg, JSON.stringify({ requestId, statusCode, durationMs }));
    }
  }
}
