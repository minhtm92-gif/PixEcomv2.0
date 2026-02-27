// ─── Facebook Ad Strategy Presets ──────────────────────────────────────────────
// System-level CBO strategy presets used in the campaign creation wizard.
// All presets use: CBO (Campaign Budget Optimization), attribution 1d_click,
// optimization max conversions, targeting Advantage+ (Facebook broad/auto).

export interface StrategyPreset {
  key: string;
  label: string;
  description: string;
  adsets: number;
  adsPerAdset: number;
  totalAds: number;
}

export const STRATEGY_PRESETS: StrategyPreset[] = [
  {
    key: 'CBO_1_5_3',
    label: 'CBO 1-5-3',
    description: '1 campaign, 5 adsets, 3 ads per adset',
    adsets: 5,
    adsPerAdset: 3,
    totalAds: 15,
  },
  {
    key: 'CBO_1_5_1',
    label: 'CBO 1-5-1',
    description: '1 campaign, 5 adsets, 1 ad per adset',
    adsets: 5,
    adsPerAdset: 1,
    totalAds: 5,
  },
  {
    key: 'CBO_1_1_3',
    label: 'CBO 1-1-3',
    description: '1 campaign, 1 adset, 3 ads per adset',
    adsets: 1,
    adsPerAdset: 3,
    totalAds: 3,
  },
];

/** Common config for all CBO presets */
export const CBO_DEFAULTS = {
  budgetOptimization: 'CBO' as const,
  attributionWindow: '1d_click' as const,
  optimizationGoal: 'CONVERSIONS' as const,
  targeting: 'ADVANTAGE_PLUS' as const,
};
