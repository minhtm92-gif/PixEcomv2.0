import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { HttpException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MetaRateLimiter } from './meta-rate-limiter';
import { MetaTokenService } from './meta-token.service';
import { MetaApiErrorResponse, MetaPagedResponse } from './meta.types';

// ─── Constants ────────────────────────────────────────────────────────────────

const META_GRAPH_BASE = 'https://graph.facebook.com/v21.0';

/** Retry configuration for transient 5xx errors */
const RETRY_DELAYS_MS = [1_000, 2_000, 4_000]; // 3 attempts: 1s, 2s, 4s backoff

/** Meta API error codes → NestJS exception mapping */
const META_ERROR_CODE_MAP: Record<number, () => never> = {
  190: () => {
    throw new UnauthorizedException(
      'Meta access token has expired or is invalid. Please re-authenticate.',
    );
  },
  17: () => {
    throw new HttpException(
      { message: 'Meta API rate limit exceeded. Retry later.' },
      429,
    );
  },
  100: () => {
    throw new BadRequestException(
      'Invalid Meta API request parameters.',
    );
  },
};

// ─── MetaService ──────────────────────────────────────────────────────────────

@Injectable()
export class MetaService {
  private readonly logger = new Logger(MetaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: MetaTokenService,
    private readonly rateLimiter: MetaRateLimiter,
  ) {}

  // ─── Public HTTP methods ──────────────────────────────────────────────────

  /**
   * GET {path} with optional query params.
   * Access token is injected from the resolved FbConnection.
   */
  async get<T>(
    adAccountInternalId: string,
    path: string,
    params: Record<string, string> = {},
  ): Promise<T> {
    const token = await this.resolveToken(adAccountInternalId);
    const url = this.buildUrl(path, { ...params, access_token: token });
    return this.requestWithRetry<T>('GET', url, adAccountInternalId);
  }

  /**
   * POST {path} with JSON body.
   * Access token is injected as a query param (Meta convention for POST).
   */
  async post<T>(
    adAccountInternalId: string,
    path: string,
    body: Record<string, unknown> = {},
  ): Promise<T> {
    const token = await this.resolveToken(adAccountInternalId);
    const url = this.buildUrl(path, { access_token: token });
    return this.requestWithRetry<T>('POST', url, adAccountInternalId, body);
  }

  /**
   * DELETE {path}.
   * Access token is injected as a query param.
   */
  async delete<T>(
    adAccountInternalId: string,
    path: string,
  ): Promise<T> {
    const token = await this.resolveToken(adAccountInternalId);
    const url = this.buildUrl(path, { access_token: token });
    return this.requestWithRetry<T>('DELETE', url, adAccountInternalId);
  }

  // ─── Token resolution ─────────────────────────────────────────────────────

  /**
   * Look up the FbConnection by internal UUID, decrypt its token.
   * Throws 401 if the connection has no stored token.
   */
  async resolveToken(adAccountInternalId: string): Promise<string> {
    const conn = await this.prisma.fbConnection.findUnique({
      where: { id: adAccountInternalId },
      select: { id: true, accessTokenEnc: true, externalId: true },
    });

    if (!conn) {
      throw new BadRequestException(
        `FbConnection ${adAccountInternalId} not found`,
      );
    }

    if (!conn.accessTokenEnc) {
      throw new UnauthorizedException(
        'No access token stored for this ad account. Please connect via OAuth.',
      );
    }

    return this.tokenService.decrypt(conn.accessTokenEnc);
  }

  /**
   * Look up the external ID of a FbConnection (used for rate limiting).
   */
  async resolveExternalId(adAccountInternalId: string): Promise<string> {
    const conn = await this.prisma.fbConnection.findUnique({
      where: { id: adAccountInternalId },
      select: { externalId: true },
    });
    return conn?.externalId ?? adAccountInternalId;
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private buildUrl(
    path: string,
    params: Record<string, string>,
  ): string {
    const base = path.startsWith('http') ? path : `${META_GRAPH_BASE}/${path.replace(/^\//, '')}`;
    const qs = new URLSearchParams(params).toString();
    return `${base}?${qs}`;
  }

  /**
   * Execute a fetch request with:
   *  - Rate limit check (before request)
   *  - Retry on 500/503 with exponential backoff
   *  - Meta error code mapping on API-level errors
   */
  private async requestWithRetry<T>(
    method: 'GET' | 'POST' | 'DELETE',
    url: string,
    adAccountInternalId: string,
    body?: Record<string, unknown>,
  ): Promise<T> {
    // Check per-account rate limit
    const externalId = await this.resolveExternalId(adAccountInternalId);
    this.rateLimiter.checkLimit(externalId);

    let lastError: unknown;

    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      try {
        const response = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          ...(body !== undefined && { body: JSON.stringify(body) }),
        });

        // Retry on transient server errors (5xx)
        if (response.status >= 500 && response.status < 600) {
          if (attempt < RETRY_DELAYS_MS.length) {
            const delay = RETRY_DELAYS_MS[attempt];
            this.logger.warn(
              `Meta API returned ${response.status} on attempt ${attempt + 1}. ` +
                `Retrying in ${delay}ms…`,
            );
            await sleep(delay);
            lastError = new Error(`HTTP ${response.status}`);
            continue;
          }
          // All retries exhausted
          throw new InternalServerErrorException(
            `Meta API returned ${response.status} after ${RETRY_DELAYS_MS.length} retries`,
          );
        }

        const json = (await response.json()) as T | MetaApiErrorResponse;

        // Check for Meta-level error in a 200 response (Meta's pattern)
        if (isMetaError(json)) {
          this.mapMetaError(json.error.code, json.error.message);
        }

        return json as T;
      } catch (err) {
        // Re-throw NestJS HTTP exceptions immediately (no retry)
        if (err instanceof HttpException) throw err;

        if (attempt < RETRY_DELAYS_MS.length) {
          this.logger.warn(
            `Meta API request failed on attempt ${attempt + 1}: ${(err as Error).message}. Retrying…`,
          );
          await sleep(RETRY_DELAYS_MS[attempt]);
          lastError = err;
          continue;
        }

        lastError = err;
        break;
      }
    }

    this.logger.error('Meta API request failed after all retries', lastError);
    throw new InternalServerErrorException('Meta API request failed');
  }

  /**
   * Map Meta API error codes to NestJS exceptions.
   * Unmapped codes fall through to InternalServerErrorException.
   */
  private mapMetaError(code: number, message: string): never {
    const thrower = META_ERROR_CODE_MAP[code];
    if (thrower) {
      thrower();
    }
    this.logger.error(`Unmapped Meta error code ${code}: ${message}`);
    throw new InternalServerErrorException(
      `Meta API error ${code}: ${message}`,
    );
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isMetaError(data: unknown): data is MetaApiErrorResponse {
  return (
    typeof data === 'object' &&
    data !== null &&
    'error' in data &&
    typeof (data as MetaApiErrorResponse).error?.code === 'number'
  );
}

// ─── Re-export paged response helper ─────────────────────────────────────────

export type { MetaPagedResponse };
