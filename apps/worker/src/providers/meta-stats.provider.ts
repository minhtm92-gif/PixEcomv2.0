/**
 * meta-stats.provider.ts
 *
 * Real Meta Graph API stats fetcher.
 * Fetches campaign, adset, and ad level insights for a given ad account.
 * Handles cursor-based pagination, empty data, and API errors gracefully.
 */

import { findActionValue, mapInsightRow, MetaInsightRow } from '../utils/field-mapper';
import {
  AdAccountFetchResult,
  EntityStats,
  IStatsProvider,
  MetaInsightLevel,
} from './types';

// ─── Constants ────────────────────────────────────────────────────────────────

const META_GRAPH_BASE = 'https://graph.facebook.com/v21.0';

/**
 * Fields requested from Meta Insights API.
 * inline_link_clicks maps to linkClicks in DB.
 */
const INSIGHT_FIELDS = [
  'spend',
  'impressions',
  'inline_link_clicks',
  'actions',
  'action_values',
  'campaign_id',
  'adset_id',
  'ad_id',
].join(',');

/** Max pages to fetch per level (safety cap — prevents infinite loop on buggy pagination) */
const MAX_PAGES = 50;

// ─── Types for Meta API pagination ───────────────────────────────────────────

interface MetaPagedResponse<T> {
  data: T[];
  paging?: {
    cursors?: { after?: string; before?: string };
    next?: string;
  };
  error?: { code: number; message: string };
}

// ─── MetaStatsProvider ────────────────────────────────────────────────────────

export class MetaStatsProvider implements IStatsProvider {
  constructor(private readonly logger: { log: (msg: string) => void; error: (msg: string, err?: unknown) => void }) {}

  async fetchForAccount(
    adAccountInternalId: string,
    adAccountExternalId: string,
    accessToken: string,
    dateFrom: string,
    dateTo: string,
  ): Promise<AdAccountFetchResult> {
    const levels: MetaInsightLevel[] = ['campaign', 'adset', 'ad'];
    const allEntities: EntityStats[] = [];

    for (const level of levels) {
      try {
        const rows = await this.fetchLevelInsights(
          adAccountExternalId,
          accessToken,
          level,
          dateFrom,
          dateTo,
        );
        for (const row of rows) {
          const entityId = resolveEntityId(row, level);
          const externalEntityId = resolveExternalId(row, level);
          if (!externalEntityId) continue; // skip rows missing entity ID

          const stats = mapInsightRow(row);
          allEntities.push({ entityId, externalEntityId, level, stats });
        }
      } catch (err) {
        // Log and skip this level — don't crash the whole worker run
        this.logger.error(
          `Failed to fetch ${level} insights for account ${adAccountExternalId}: ${(err as Error).message}`,
          err,
        );
      }
    }

    return {
      sellerId: '', // filled in by processor (not known here)
      adAccountInternalId,
      adAccountExternalId,
      entities: allEntities,
    };
  }

  /**
   * Fetch all pages of insights for a given level.
   * Handles cursor-based pagination via response.paging.next.
   */
  private async fetchLevelInsights(
    adAccountExternalId: string,
    accessToken: string,
    level: MetaInsightLevel,
    dateFrom: string,
    dateTo: string,
  ): Promise<MetaInsightRow[]> {
    const results: MetaInsightRow[] = [];
    const timeRange = JSON.stringify({ since: dateFrom, until: dateTo });

    // Build initial URL
    const path = `act_${adAccountExternalId}/insights`;
    const params = new URLSearchParams({
      fields: INSIGHT_FIELDS,
      level,
      time_range: timeRange,
      time_increment: '1',      // one row per day per entity
      limit: '500',              // max rows per page
      access_token: accessToken,
    });

    let url: string | null = `${META_GRAPH_BASE}/${path}?${params.toString()}`;
    let page = 0;

    while (url && page < MAX_PAGES) {
      page++;
      const response = await this.fetchPage(url);

      if (!response) break;

      // Handle API-level errors in 200 responses (Meta pattern)
      if (response.error) {
        throw new Error(
          `Meta API error ${response.error.code}: ${response.error.message}`,
        );
      }

      if (response.data && response.data.length > 0) {
        results.push(...response.data);
      }

      // Follow pagination cursor
      url = response.paging?.next ?? null;
    }

    return results;
  }

  /**
   * Execute a single GET fetch call.
   * Returns null on empty/error to allow graceful handling.
   */
  private async fetchPage(
    url: string,
  ): Promise<MetaPagedResponse<MetaInsightRow> | null> {
    let response: Response;
    try {
      response = await fetch(url, {
        headers: { Accept: 'application/json' },
      });
    } catch (err) {
      this.logger.error(`Network error fetching Meta insights: ${(err as Error).message}`);
      return null;
    }

    if (response.status === 400 || response.status === 401 || response.status === 403) {
      const body = await response.json().catch(() => ({}));
      throw new Error(
        `Meta API returned ${response.status}: ${JSON.stringify(body)}`,
      );
    }

    if (!response.ok) {
      this.logger.error(`Meta API returned ${response.status} for ${url}`);
      return null;
    }

    return response.json() as Promise<MetaPagedResponse<MetaInsightRow>>;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extract the external Meta entity ID from a row based on level.
 * Used as externalEntityId in AdStatsRaw.
 */
function resolveExternalId(row: MetaInsightRow, level: MetaInsightLevel): string | null {
  switch (level) {
    case 'campaign': return row.campaign_id ?? null;
    case 'adset':    return row.adset_id ?? null;
    case 'ad':       return row.ad_id ?? null;
  }
}

/**
 * For now, entityId mirrors externalEntityId.
 * In production, the processor does a DB lookup to resolve internal UUID.
 * Returning externalId here; processor overrides with internal UUID.
 */
function resolveEntityId(row: MetaInsightRow, level: MetaInsightLevel): string {
  return resolveExternalId(row, level) ?? '';
}
