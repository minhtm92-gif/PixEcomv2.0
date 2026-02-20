import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '@pixecom/database';

/**
 * HttpExceptionFilter — WS3 (Milestone 2.3.7)
 *
 * Global exception filter. Catches ALL exceptions and normalises them into
 * a consistent safe response shape:
 *
 *   { error: { code, message, requestId, details? } }
 *
 * Prisma error mapping:
 *   P2002 unique constraint  → 409 CONFLICT
 *   P2025 record not found   → 404 NOT_FOUND
 *   P2003 FK violation       → 400 BAD_REQUEST
 *   P2016 record not found   → 404 NOT_FOUND
 *
 * Stack traces are NEVER exposed in responses.
 * Sensitive fields (tokens, passwords, fileUrl) are never logged.
 */

const PRISMA_CODE_MAP: Record<string, { status: number; code: string; message: string }> = {
  P2002: { status: 409, code: 'CONFLICT',     message: 'A record with that value already exists.' },
  P2025: { status: 404, code: 'NOT_FOUND',    message: 'Record not found.' },
  P2016: { status: 404, code: 'NOT_FOUND',    message: 'Record not found.' },
  P2003: { status: 400, code: 'BAD_REQUEST',  message: 'Related record not found.' },
};

const HTTP_CODE_MAP: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  422: 'UNPROCESSABLE_ENTITY',
  429: 'TOO_MANY_REQUESTS',
  500: 'INTERNAL_SERVER_ERROR',
  503: 'SERVICE_UNAVAILABLE',
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx   = host.switchToHttp();
    const req   = ctx.getRequest<Request & { requestId?: string }>();
    const res   = ctx.getResponse<Response>();

    const requestId = req.requestId ?? 'unknown';
    const isDev     = process.env.NODE_ENV !== 'production';

    // ── Prisma known errors ──────────────────────────────────────────────
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const mapped = PRISMA_CODE_MAP[exception.code];
      if (mapped) {
        res.status(mapped.status).json({
          error: {
            code:      mapped.code,
            message:   mapped.message,
            requestId,
          },
        });
        return;
      }
    }

    // ── Prisma validation errors ─────────────────────────────────────────
    if (exception instanceof Prisma.PrismaClientValidationError) {
      res.status(400).json({
        error: {
          code:      'BAD_REQUEST',
          message:   'Invalid data provided.',
          requestId,
          ...(isDev ? { details: exception.message.split('\n').slice(-2).join(' ') } : {}),
        },
      });
      return;
    }

    // ── NestJS HttpException (includes ValidationPipe errors) ────────────
    if (exception instanceof HttpException) {
      const status  = exception.getStatus();
      const resBody = exception.getResponse();
      const code    = HTTP_CODE_MAP[status] ?? 'INTERNAL_SERVER_ERROR';

      // ValidationPipe returns { message: string[], error: string }
      let message: string;
      let details: string[] | undefined;

      if (typeof resBody === 'object' && resBody !== null) {
        const body = resBody as Record<string, unknown>;
        if (Array.isArray(body.message)) {
          message = 'Validation failed.';
          details = body.message as string[];
        } else {
          message = (body.message as string) ?? exception.message;
        }
      } else {
        message = String(resBody);
      }

      res.status(status).json({
        error: {
          code,
          message,
          requestId,
          ...(details ? { details } : {}),
        },
      });
      return;
    }

    // ── Unknown / unhandled errors ───────────────────────────────────────
    this.logger.error({
      msg:       'Unhandled exception',
      requestId,
      route:     req.path,
      method:    req.method,
      errorType: (exception as Error)?.constructor?.name ?? 'UnknownError',
      // Only log message — never stack trace or payload in prod
      errorMsg:  (exception as Error)?.message ?? String(exception),
    });

    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: {
        code:      'INTERNAL_SERVER_ERROR',
        message:   'An unexpected error occurred.',
        requestId,
        ...(isDev ? { details: (exception as Error)?.message } : {}),
      },
    });
  }
}
