import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { TrackingResult } from './tracking.provider';

/**
 * 17track status code → normalised status string.
 * Reference: https://api.17track.net/en/doc#status
 */
const STATUS_MAP: Record<number, string> = {
  0:  'PENDING',
  10: 'IN_TRANSIT',
  20: 'ARRIVED',
  30: 'DELIVERED',
  35: 'UNDELIVERED',
  40: 'EXCEPTION',
};

/**
 * SevenTrackProvider
 *
 * Calls the 17track v2 REST API to get tracking status for a parcel.
 * API key is read from SEVENTEEN_TRACK_API_KEY env var.
 *
 * Contract: NEVER throws — always returns a TrackingResult.
 * On any error (network, bad response, missing data) → { status: 'UNKNOWN' }.
 *
 * E2E tests mock this provider via jest.spyOn to avoid real HTTP calls.
 */
@Injectable()
export class SevenTrackProvider {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.17track.net/track/v2';

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {
    this.apiKey = this.config.get<string>('SEVENTEEN_TRACK_API_KEY') ?? '';
  }

  async refreshTracking(
    trackingNumber: string,
    _carrier?: string,
  ): Promise<TrackingResult> {
    try {
      const response = await firstValueFrom(
        this.http.post(
          `${this.baseUrl}/gettracklist`,
          { number: trackingNumber },
          {
            headers: {
              '17token': this.apiKey,
              'Content-Type': 'application/json',
            },
            timeout: 8000,
          },
        ),
      );

      const body = response.data;

      // 17track response shape:
      // { code: 0, data: { accepted: [{ number, track: { z1: [{z: statusCode, c: event}] } }] } }
      const accepted: any[] = body?.data?.accepted ?? [];
      const first = accepted[0];

      if (!first) {
        return { status: 'UNKNOWN', updatedAt: new Date() };
      }

      const track = first.track;
      // z1 = latest tracking events (newest first)
      const latestEvent = track?.z1?.[0];
      const statusCode: number = latestEvent?.z ?? -1;
      const lastEventDesc: string | undefined = latestEvent?.c;

      const status = STATUS_MAP[statusCode] ?? 'UNKNOWN';

      return {
        status,
        lastEvent: lastEventDesc,
        updatedAt: new Date(),
      };
    } catch {
      // Network error, timeout, or parse failure — return safe fallback
      return { status: 'UNKNOWN', updatedAt: new Date() };
    }
  }
}
