import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import IORedis from 'ioredis';

/**
 * HealthService — WS4 (Milestone 2.3.7)
 *
 * Provides DB and Redis liveness checks with hard timeouts so /api/health
 * always responds quickly regardless of infrastructure state.
 *
 * DB check  : SELECT 1 (2 s timeout)
 * Redis check: PING    (2 s timeout)
 */

export type ComponentStatus = 'connected' | 'down';

export interface HealthResult {
  status: 'ok' | 'degraded';
  service: string;
  timestamp: string;
  requestId: string;
  db: ComponentStatus;
  redis: ComponentStatus;
}

const TIMEOUT_MS = 2_000;

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  fallback: T,
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private readonly redisUrl: string;

  constructor(private readonly prisma: PrismaService) {
    this.redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
  }

  async check(requestId: string): Promise<HealthResult> {
    const [db, redis] = await Promise.all([
      this.checkDb(),
      this.checkRedis(),
    ]);

    const status: 'ok' | 'degraded' = db === 'connected' && redis === 'connected'
      ? 'ok'
      : 'degraded';

    if (status === 'degraded') {
      this.logger.warn(`Health degraded — db:${db} redis:${redis}`, requestId);
    }

    return {
      status,
      service: 'pixecom-api',
      timestamp: new Date().toISOString(),
      requestId,
      db,
      redis,
    };
  }

  private async checkDb(): Promise<ComponentStatus> {
    try {
      await withTimeout(
        this.prisma.$queryRaw`SELECT 1`,
        TIMEOUT_MS,
        null,
      );
      return 'connected';
    } catch {
      this.logger.error('DB health check failed');
      return 'down';
    }
  }

  private async checkRedis(): Promise<ComponentStatus> {
    let client: IORedis | null = null;
    try {
      client = new IORedis(this.redisUrl, {
        maxRetriesPerRequest: 0,
        connectTimeout: TIMEOUT_MS,
        lazyConnect: true,
      });
      await withTimeout(
        client.connect().then(() => client!.ping()),
        TIMEOUT_MS,
        null,
      );
      return 'connected';
    } catch {
      this.logger.warn('Redis health check failed (non-fatal)');
      return 'down';
    } finally {
      if (client) {
        try { client.disconnect(); } catch { /* ignore */ }
      }
    }
  }
}
