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

/** Render metric: if storeMetricsPending is true, show "N/A" */
export function metricOrNA(value: number, pending: boolean, formatter: (n: number) => string = num): string {
  if (pending) return 'N/A';
  return formatter(value);
}
