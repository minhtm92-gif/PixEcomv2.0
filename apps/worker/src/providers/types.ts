/**
 * Provider interface for fetching Meta ad insights.
 *
 * Two implementations:
 *   MetaStatsProvider  — calls real Graph API (Phase 2+)
 *   MockStatsProvider  — returns deterministic mock data (Phase 1 / tests)
 */

import type { MappedStats } from '../utils/field-mapper';

/** Entity levels Meta supports for insights */
export type MetaInsightLevel = 'campaign' | 'adset' | 'ad';

/** One unit of fetched stats tied to a Meta entity */
export interface EntityStats {
  /** Our internal DB UUID for the entity */
  entityId: string;
  /** Meta's external ID (e.g. campaign_id, adset_id, ad_id) */
  externalEntityId: string;
  /** Entity type for storage */
  level: MetaInsightLevel;
  stats: MappedStats;
}

/** Result from a single ad-account fetch */
export interface AdAccountFetchResult {
  sellerId: string;
  adAccountInternalId: string;
  adAccountExternalId: string;
  entities: EntityStats[];
}

/**
 * IStatsProvider — pluggable interface.
 * Implement this for real Meta API or mocks.
 */
export interface IStatsProvider {
  /**
   * Fetch stats for all entities (campaign + adset + ad levels) for one ad account.
   *
   * @param adAccountInternalId  Our internal UUID for the FbConnection
   * @param adAccountExternalId  Meta's act_xxx identifier
   * @param accessToken          Decrypted FB access token
   * @param dateFrom             YYYY-MM-DD (inclusive)
   * @param dateTo               YYYY-MM-DD (inclusive)
   */
  fetchForAccount(
    adAccountInternalId: string,
    adAccountExternalId: string,
    accessToken: string,
    dateFrom: string,
    dateTo: string,
  ): Promise<AdAccountFetchResult>;
}
