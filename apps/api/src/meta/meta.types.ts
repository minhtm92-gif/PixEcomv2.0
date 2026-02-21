// ─── Meta Graph API error shape ───────────────────────────────────────────────

export interface MetaApiError {
  message: string;
  type: string;
  code: number;
  error_subcode?: number;
  fbtrace_id?: string;
}

export interface MetaApiErrorResponse {
  error: MetaApiError;
}

// ─── Generic paginated response ───────────────────────────────────────────────

export interface MetaPaging {
  cursors?: { before: string; after: string };
  next?: string;
  previous?: string;
}

export interface MetaPagedResponse<T> {
  data: T[];
  paging?: MetaPaging;
}

// ─── OAuth ────────────────────────────────────────────────────────────────────

export interface MetaOAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
}

// ─── Campaign ────────────────────────────────────────────────────────────────

export interface MetaCampaign {
  id: string;
  name: string;
  status: string;
  effective_status: string;
  objective: string;
  daily_budget?: string;
  lifetime_budget?: string;
  created_time: string;
  updated_time: string;
}

// ─── Insights ────────────────────────────────────────────────────────────────

export interface MetaInsightsRow {
  campaign_id?: string;
  adset_id?: string;
  ad_id?: string;
  date_start: string;
  date_stop: string;
  spend: string;
  impressions: string;
  cpm: string;
  ctr: string;
  cpc: string;
  clicks: string;
  reach: string;
  actions?: Array<{ action_type: string; value: string }>;
  cost_per_action_type?: Array<{ action_type: string; value: string }>;
  purchase_roas?: Array<{ action_type: string; value: string }>;
}

// ─── Ad Account ──────────────────────────────────────────────────────────────

export interface MetaAdAccount {
  id: string;
  name: string;
  account_status: number;
  currency: string;
  timezone_name: string;
}
