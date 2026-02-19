import { createHash } from 'crypto';
import { RawStatRow, StatProvider } from './stat-provider.interface';

/**
 * MockProvider — deterministic, seeded fake stats generator.
 *
 * Seed derivation:
 *   seed = first 4 bytes of SHA256(sellerId + ':' + entityId + ':' + dateStr) → uint32
 *
 * All values are deterministic: the same inputs always produce the same output.
 * Safe for idempotent re-runs.
 */
export class MockProvider implements StatProvider {
  async fetchStats(
    sellerId: string,
    level: 'CAMPAIGN' | 'ADSET' | 'AD',
    entities: Array<{ id: string; externalId: string | null; budget: number }>,
    dateFrom: string,
    dateTo: string,
  ): Promise<RawStatRow[]> {
    const fetchedAt = new Date();
    const dateStart = new Date(`${dateFrom}T00:00:00.000Z`);
    const dateStop = new Date(`${dateTo}T00:00:00.000Z`);

    return entities.map((entity) =>
      this.generateRow(
        sellerId,
        level,
        entity.id,
        entity.externalId ?? entity.id,
        entity.budget,
        dateFrom,
        fetchedAt,
        dateStart,
        dateStop,
      ),
    );
  }

  private generateRow(
    sellerId: string,
    entityType: 'CAMPAIGN' | 'ADSET' | 'AD',
    entityId: string,
    externalEntityId: string,
    budget: number,
    dateStr: string,
    fetchedAt: Date,
    dateStart: Date,
    dateStop: Date,
  ): RawStatRow {
    const rng = this.makeRng(sellerId, entityId, dateStr);

    // ── Spend ────────────────────────────────────────────────────────────────
    // Base spend = budget (assumed daily). Apply ±15% noise.
    const noiseMultiplier = 0.85 + rng() * 0.30; // [0.85, 1.15]
    const spend = round2(Math.max(0, budget * noiseMultiplier));

    // ── Funnel (each step adds its own ±10% noise) ───────────────────────────
    const CPM_BASE = 8.50; // $8.50 per 1000 impressions
    const impressions = roundInt(Math.max(0, (spend / CPM_BASE) * 1000 * (0.90 + rng() * 0.20)));

    const linkClicks = roundInt(impressions * 0.020 * (0.90 + rng() * 0.20));
    const contentViews = roundInt(linkClicks * 0.70 * (0.90 + rng() * 0.20));
    const addToCart = roundInt(contentViews * 0.12 * (0.90 + rng() * 0.20));
    const checkoutInitiated = roundInt(addToCart * 0.50 * (0.90 + rng() * 0.20));
    const purchases = roundInt(checkoutInitiated * 0.40 * (0.90 + rng() * 0.20));

    // Average order value: seeded value in [$35, $150]
    const aov = 35 + rng() * 115;
    const purchaseValue = round2(purchases * aov);

    // ── Derived ratios ───────────────────────────────────────────────────────
    const cpm = impressions > 0 ? round4(spend / impressions * 1000) : 0;
    const ctr = impressions > 0 ? round4(linkClicks / impressions) : 0;
    const cpc = linkClicks > 0 ? round4(spend / linkClicks) : 0;
    const costPerPurchase = purchases > 0 ? round4(spend / purchases) : 0;
    const roas = spend > 0 ? round4(purchaseValue / spend) : 0;

    return {
      sellerId,
      entityType,
      entityId,
      externalEntityId,
      fetchedAt,
      dateStart,
      dateStop,
      spend,
      purchaseValue,
      impressions,
      linkClicks,
      contentViews,
      addToCart,
      checkoutInitiated,
      purchases,
      cpm,
      ctr,
      cpc,
      costPerPurchase,
      roas,
    };
  }

  /**
   * Returns a seeded PRNG function using mulberry32 algorithm.
   * The seed is derived from the first 4 bytes of SHA256(sellerId:entityId:date).
   */
  private makeRng(sellerId: string, entityId: string, dateStr: string): () => number {
    const hash = createHash('sha256')
      .update(`${sellerId}:${entityId}:${dateStr}`)
      .digest();

    let state = hash.readUInt32BE(0);

    // mulberry32 PRNG — returns [0, 1)
    return () => {
      state |= 0;
      state = (state + 0x6d2b79f5) | 0;
      let z = Math.imul(state ^ (state >>> 15), 1 | state);
      z = (z + Math.imul(z ^ (z >>> 7), 61 | z)) ^ z;
      return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
    };
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function roundInt(n: number): number {
  return Math.max(0, Math.round(n));
}
