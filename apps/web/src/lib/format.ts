/** Format currency from cents */
export function money(cents: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

/** Format currency from whole dollar value (not cents) */
export function moneyWhole(value: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

/** Format a number with commas */
export function num(n: number): string {
  return new Intl.NumberFormat('en-US').format(n);
}

/** Format percentage (already *100 from backend) */
export function pct(n: number): string {
  return `${n.toFixed(2)}%`;
}

/** Format ISO date string */
export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** Format ISO date string with time */
export function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Format a date as YYYY-MM-DD for API params */
export function toApiDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

/** Get today's date as YYYY-MM-DD */
export function today(): string {
  return toApiDate(new Date());
}

/** Get date N days ago as YYYY-MM-DD */
export function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toApiDate(d);
}

/**
 * Safely convert a Prisma Decimal string to a number.
 * Returns 0 if the value is null, undefined, empty, or NaN.
 */
export function safeDecimal(value: string | number | null | undefined): number {
  if (value == null || value === '') return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Format a Prisma Decimal string as currency (whole dollars, not cents).
 * Handles string/number/null safely.
 */
export function moneyDecimal(value: string | number | null | undefined, currency = 'USD'): string {
  return moneyWhole(safeDecimal(value), currency);
}

/**
 * Safely format an ISO date string. Returns "—" if invalid.
 */
export function safeFmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** Render metric: always show value (never N/A) */
export function metricOrNA(value: number, _pending: boolean, formatter: (n: number) => string = num): string {
  return formatter(value);
}
