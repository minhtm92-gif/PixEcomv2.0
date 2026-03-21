// ─── Shared Country List (ISO 3166-1 alpha-2) ────────────────────────────────

export interface CountryOption {
  code: string;
  name: string;
  flag: string;
}

export const COUNTRIES: CountryOption[] = [
  // Primary markets (top)
  { code: 'US', name: 'United States', flag: '\u{1F1FA}\u{1F1F8}' },
  { code: 'CA', name: 'Canada', flag: '\u{1F1E8}\u{1F1E6}' },
  // Europe
  { code: 'GB', name: 'United Kingdom', flag: '\u{1F1EC}\u{1F1E7}' },
  { code: 'DE', name: 'Germany', flag: '\u{1F1E9}\u{1F1EA}' },
  { code: 'FR', name: 'France', flag: '\u{1F1EB}\u{1F1F7}' },
  { code: 'IT', name: 'Italy', flag: '\u{1F1EE}\u{1F1F9}' },
  { code: 'ES', name: 'Spain', flag: '\u{1F1EA}\u{1F1F8}' },
  { code: 'NL', name: 'Netherlands', flag: '\u{1F1F3}\u{1F1F1}' },
  { code: 'PL', name: 'Poland', flag: '\u{1F1F5}\u{1F1F1}' },
  // Asia-Pacific
  { code: 'AU', name: 'Australia', flag: '\u{1F1E6}\u{1F1FA}' },
  { code: 'NZ', name: 'New Zealand', flag: '\u{1F1F3}\u{1F1FF}' },
  { code: 'JP', name: 'Japan', flag: '\u{1F1EF}\u{1F1F5}' },
  { code: 'KR', name: 'South Korea', flag: '\u{1F1F0}\u{1F1F7}' },
  { code: 'IN', name: 'India', flag: '\u{1F1EE}\u{1F1F3}' },
  { code: 'TW', name: 'Taiwan', flag: '\u{1F1F9}\u{1F1FC}' },
  { code: 'HK', name: 'Hong Kong', flag: '\u{1F1ED}\u{1F1F0}' },
  // Southeast Asia
  { code: 'VN', name: 'Vietnam', flag: '\u{1F1FB}\u{1F1F3}' },
  { code: 'TH', name: 'Thailand', flag: '\u{1F1F9}\u{1F1ED}' },
  { code: 'ID', name: 'Indonesia', flag: '\u{1F1EE}\u{1F1E9}' },
  { code: 'PH', name: 'Philippines', flag: '\u{1F1F5}\u{1F1ED}' },
  { code: 'MY', name: 'Malaysia', flag: '\u{1F1F2}\u{1F1FE}' },
  { code: 'SG', name: 'Singapore', flag: '\u{1F1F8}\u{1F1EC}' },
  // Americas
  { code: 'MX', name: 'Mexico', flag: '\u{1F1F2}\u{1F1FD}' },
  { code: 'BR', name: 'Brazil', flag: '\u{1F1E7}\u{1F1F7}' },
  // Middle East
  { code: 'AE', name: 'UAE', flag: '\u{1F1E6}\u{1F1EA}' },
  { code: 'SA', name: 'Saudi Arabia', flag: '\u{1F1F8}\u{1F1E6}' },
];

/** Look up country name by ISO code */
export function countryName(code: string): string {
  return COUNTRIES.find((c) => c.code === code)?.name ?? code;
}
