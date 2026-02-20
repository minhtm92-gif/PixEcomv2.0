import { Controller, Get, HttpCode, Req } from '@nestjs/common';
import { Request } from 'express';
import { HealthService } from './health.service';

/**
 * HealthController — WS4 (Milestone 2.3.7)
 *
 * GET /api/health — returns service readiness with DB + Redis status.
 *
 * Response shape:
 *   {
 *     status:    "ok" | "degraded",
 *     service:   "pixecom-api",
 *     timestamp: ISO8601,
 *     requestId: string,
 *     db:        "connected" | "down",
 *     redis:     "connected" | "down",
 *   }
 *
 * Always returns HTTP 200. Callers inspect the `status` field for degradation.
 */
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @HttpCode(200)
  check(@Req() req: Request & { requestId?: string }) {
    const requestId = req.requestId ?? 'unknown';
    return this.healthService.check(requestId);
  }
}
