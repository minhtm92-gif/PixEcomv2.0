import {
  aggregateStats,
  findActionValue,
  mapInsightRow,
  MappedStats,
  MetaActionItem,
  MetaInsightRow,
  safeDivide,
} from './field-mapper';

// ─── safeDivide ───────────────────────────────────────────────────────────────

describe('safeDivide', () => {
  it('1. returns numerator/denominator for normal values', () => {
    expect(safeDivide(100, 4)).toBe(25);
  });

  it('2. returns 0 when denominator is 0', () => {
    expect(safeDivide(50, 0)).toBe(0);
  });

  it('3. returns 0 when numerator is 0', () => {
    expect(safeDivide(0, 100)).toBe(0);
  });

  it('4. returns 0 when denominator is NaN', () => {
    expect(safeDivide(10, NaN)).toBe(0);
  });

  it('5. handles floating point correctly', () => {
    expect(safeDivide(1, 3)).toBeCloseTo(0.3333, 4);
  });
});

// ─── findActionValue ──────────────────────────────────────────────────────────

describe('findActionValue', () => {
  const actions: MetaActionItem[] = [
    { action_type: 'content_view', value: '42' },
    { action_type: 'purchase', value: '7' },
    { action_type: 'initiate_checkout', value: '15' },
  ];

  it('6. returns numeric value for existing action_type', () => {
    expect(findActionValue(actions, 'content_view')).toBe(42);
  });

  it('7. returns 0 for missing action_type', () => {
    expect(findActionValue(actions, 'add_to_cart')).toBe(0);
  });

  it('8. returns 0 for undefined actions array', () => {
    expect(findActionValue(undefined, 'purchase')).toBe(0);
  });

  it('9. returns 0 for empty actions array', () => {
    expect(findActionValue([], 'purchase')).toBe(0);
  });
});

// ─── mapInsightRow ────────────────────────────────────────────────────────────

describe('mapInsightRow', () => {
  const fullRow: MetaInsightRow = {
    campaign_id: 'camp_001',
    date_start: '2025-01-10',
    date_stop: '2025-01-10',
    spend: '120.50',
    impressions: '5000',
    inline_link_clicks: '200',
    actions: [
      { action_type: 'content_view', value: '300' },
      { action_type: 'initiate_checkout', value: '50' },
      { action_type: 'purchase', value: '10' },
    ],
    action_values: [
      { action_type: 'purchase', value: '800.00' },
    ],
  };

  let mapped: MappedStats;

  beforeAll(() => {
    mapped = mapInsightRow(fullRow);
  });

  it('10. maps spend correctly', () => {
    expect(mapped.spend).toBeCloseTo(120.50);
  });

  it('11. maps impressions correctly', () => {
    expect(mapped.impressions).toBe(5000);
  });

  it('12. maps inline_link_clicks → linkClicks (DB field name)', () => {
    expect(mapped.linkClicks).toBe(200);
  });

  it('13. maps content_view → contentViews (DB field name)', () => {
    expect(mapped.contentViews).toBe(300);
  });

  it('14. maps initiate_checkout → checkoutInitiated (DB field name)', () => {
    expect(mapped.checkoutInitiated).toBe(50);
  });

  it('15. maps purchase actions → purchases (DB field name)', () => {
    expect(mapped.purchases).toBe(10);
  });

  it('16. maps purchase action_values → purchaseValue (DB field name)', () => {
    expect(mapped.purchaseValue).toBeCloseTo(800.00);
  });

  it('17. derives cpm = (spend/impressions)*1000', () => {
    // 120.50 / 5000 * 1000 = 24.1
    expect(mapped.cpm).toBeCloseTo(24.1);
  });

  it('18. derives ctr = (linkClicks/impressions)*100', () => {
    // 200 / 5000 * 100 = 4.0
    expect(mapped.ctr).toBeCloseTo(4.0);
  });

  it('19. derives cpc = spend/linkClicks', () => {
    // 120.50 / 200 = 0.6025
    expect(mapped.cpc).toBeCloseTo(0.6025);
  });

  it('20. derives costPerPurchase = spend/purchases', () => {
    // 120.50 / 10 = 12.05
    expect(mapped.costPerPurchase).toBeCloseTo(12.05);
  });

  it('21. derives roas = purchaseValue/spend', () => {
    // 800 / 120.50 ≈ 6.6390
    expect(mapped.roas).toBeCloseTo(6.6390, 2);
  });

  it('22. handles missing spend/impressions gracefully (zeros)', () => {
    const emptyRow: MetaInsightRow = {
      date_start: '2025-01-10',
      date_stop: '2025-01-10',
    };
    const result = mapInsightRow(emptyRow);
    expect(result.spend).toBe(0);
    expect(result.impressions).toBe(0);
    expect(result.linkClicks).toBe(0);
    expect(result.cpm).toBe(0);
    expect(result.ctr).toBe(0);
    expect(result.cpc).toBe(0);
    expect(result.roas).toBe(0);
  });

  it('23. preserves dateStart and dateStop', () => {
    expect(mapped.dateStart).toBe('2025-01-10');
    expect(mapped.dateStop).toBe('2025-01-10');
  });
});

// ─── aggregateStats ───────────────────────────────────────────────────────────

describe('aggregateStats', () => {
  const row1: MappedStats = {
    dateStart: '2025-01-10',
    dateStop: '2025-01-10',
    spend: 100,
    impressions: 2000,
    linkClicks: 80,
    contentViews: 120,
    checkoutInitiated: 20,
    purchases: 5,
    purchaseValue: 400,
    cpm: 50,  // will be ignored (re-derived)
    ctr: 4,
    cpc: 1.25,
    costPerPurchase: 20,
    roas: 4,
  };

  const row2: MappedStats = {
    dateStart: '2025-01-11',
    dateStop: '2025-01-11',
    spend: 150,
    impressions: 3000,
    linkClicks: 120,
    contentViews: 180,
    checkoutInitiated: 30,
    purchases: 8,
    purchaseValue: 640,
    cpm: 50,
    ctr: 4,
    cpc: 1.25,
    costPerPurchase: 18.75,
    roas: 4.267,
  };

  let agg: Omit<MappedStats, 'dateStart' | 'dateStop'>;

  beforeAll(() => {
    agg = aggregateStats([row1, row2]);
  });

  it('24. sums spend', () => {
    expect(agg.spend).toBeCloseTo(250);
  });

  it('25. sums impressions', () => {
    expect(agg.impressions).toBe(5000);
  });

  it('26. sums linkClicks', () => {
    expect(agg.linkClicks).toBe(200);
  });

  it('27. sums purchases', () => {
    expect(agg.purchases).toBe(13);
  });

  it('28. sums purchaseValue', () => {
    expect(agg.purchaseValue).toBeCloseTo(1040);
  });

  it('29. re-derives cpm from summed values (not averages)', () => {
    // cpm = (250 / 5000) * 1000 = 50.0
    expect(agg.cpm).toBeCloseTo(50.0);
  });

  it('30. re-derives roas from summed values (not averages)', () => {
    // roas = 1040 / 250 = 4.16
    expect(agg.roas).toBeCloseTo(4.16, 2);
  });

  it('31. handles empty array', () => {
    const empty = aggregateStats([]);
    expect(empty.spend).toBe(0);
    expect(empty.roas).toBe(0);
    expect(empty.cpm).toBe(0);
  });
});
