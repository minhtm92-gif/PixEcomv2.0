import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'crypto';

/**
 * RequestIdMiddleware — WS2 (Milestone 2.3.7)
 *
 * For every inbound request:
 *   - Reads `x-request-id` header if present (trust caller correlation ID)
 *   - Otherwise generates a new UUID v4
 * Attaches the ID to:
 *   - `req.requestId` — available to controllers/services
 *   - `X-Request-Id` response header — echoed back to clients
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request & { requestId?: string }, res: Response, next: NextFunction): void {
    const requestId =
      (req.headers['x-request-id'] as string | undefined) || randomUUID();

    req.requestId = requestId;
    res.setHeader('X-Request-Id', requestId);

    next();
  }
}
