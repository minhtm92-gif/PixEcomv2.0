'use client';

import { useState, useCallback } from 'react';
import { X, ChevronDown, MapPin, Users, Calendar } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

/** Targeting state used by the form. Matches Meta's targeting_spec structure. */
export interface TargetingState {
  countries: string[];
  ageMin: number;
  ageMax: number;
  gender: 'all' | 'male' | 'female';
}

export const DEFAULT_TARGETING: TargetingState = {
  countries: [],
  ageMin: 18,
  ageMax: 65,
  gender: 'all',
};

/** Convert TargetingState → Meta-compatible JSON for backend */
export function targetingToJson(t: TargetingState): Record<string, unknown> {
  const obj: Record<string, unknown> = {};

  if (t.countries.length > 0) {
    obj.geo_locations = { countries: t.countries };
  }

  if (t.ageMin !== 18) obj.age_min = t.ageMin;
  if (t.ageMax !== 65) obj.age_max = t.ageMax;

  if (t.gender === 'male') obj.genders = [1];
  else if (t.gender === 'female') obj.genders = [2];

  return obj;
}

/** Convert Meta-compatible JSON → TargetingState */
export function jsonToTargeting(json: Record<string, unknown> | null | undefined): TargetingState {
  if (!json) return { ...DEFAULT_TARGETING };

  const geo = json.geo_locations as { countries?: string[] } | undefined;
  const genders = json.genders as number[] | undefined;

  let gender: TargetingState['gender'] = 'all';
  if (genders?.length === 1) {
    if (genders[0] === 1) gender = 'male';
    else if (genders[0] === 2) gender = 'female';
  }

  return {
    countries: geo?.countries ?? [],
    ageMin: (json.age_min as number) ?? 18,
    ageMax: (json.age_max as number) ?? 65,
    gender,
  };
}

// ─── Country list (ISO 3166-1 alpha-2) ───────────────────────────────────────

interface CountryOption {
  code: string;
  name: string;
  flag: string;
}

const COUNTRIES: CountryOption[] = [
  // Southeast Asia
  { code: 'VN', name: 'Vietnam', flag: '🇻🇳' },
  { code: 'TH', name: 'Thailand', flag: '🇹🇭' },
  { code: 'ID', name: 'Indonesia', flag: '🇮🇩' },
  { code: 'PH', name: 'Philippines', flag: '🇵🇭' },
  { code: 'MY', name: 'Malaysia', flag: '🇲🇾' },
  { code: 'SG', name: 'Singapore', flag: '🇸🇬' },
  // North America
  { code: 'US', name: 'United States', flag: '🇺🇸' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦' },
  { code: 'MX', name: 'Mexico', flag: '🇲🇽' },
  // Europe
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪' },
  { code: 'FR', name: 'France', flag: '🇫🇷' },
  { code: 'IT', name: 'Italy', flag: '🇮🇹' },
  { code: 'ES', name: 'Spain', flag: '🇪🇸' },
  { code: 'NL', name: 'Netherlands', flag: '🇳🇱' },
  { code: 'PL', name: 'Poland', flag: '🇵🇱' },
  // Asia-Pacific
  { code: 'JP', name: 'Japan', flag: '🇯🇵' },
  { code: 'KR', name: 'South Korea', flag: '🇰🇷' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺' },
  { code: 'NZ', name: 'New Zealand', flag: '🇳🇿' },
  { code: 'IN', name: 'India', flag: '🇮🇳' },
  { code: 'TW', name: 'Taiwan', flag: '🇹🇼' },
  { code: 'HK', name: 'Hong Kong', flag: '🇭🇰' },
  // Middle East / Africa
  { code: 'AE', name: 'UAE', flag: '🇦🇪' },
  { code: 'SA', name: 'Saudi Arabia', flag: '🇸🇦' },
  { code: 'BR', name: 'Brazil', flag: '🇧🇷' },
];

// ─── Styles ──────────────────────────────────────────────────────────────────

const inputCls =
  'w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors';

// ─── Component ───────────────────────────────────────────────────────────────

interface TargetingFormProps {
  value: TargetingState;
  onChange: (value: TargetingState) => void;
  /** Compact mode for inline use (smaller padding, no section headers) */
  compact?: boolean;
}

export function TargetingForm({ value, onChange, compact = false }: TargetingFormProps) {
  const [countrySearch, setCountrySearch] = useState('');
  const [countryDropdownOpen, setCountryDropdownOpen] = useState(false);

  const update = useCallback(
    (partial: Partial<TargetingState>) => {
      onChange({ ...value, ...partial });
    },
    [value, onChange],
  );

  // ── Country helpers ──
  const filteredCountries = COUNTRIES.filter(
    (c) =>
      !value.countries.includes(c.code) &&
      (c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
        c.code.toLowerCase().includes(countrySearch.toLowerCase())),
  );

  function addCountry(code: string) {
    update({ countries: [...value.countries, code] });
    setCountrySearch('');
  }

  function removeCountry(code: string) {
    update({ countries: value.countries.filter((c) => c !== code) });
  }

  const sectionCls = compact ? 'space-y-2' : 'space-y-3';
  const labelCls = compact
    ? 'text-xs font-medium text-muted-foreground'
    : 'text-sm font-medium text-foreground flex items-center gap-1.5';

  return (
    <div className={compact ? 'space-y-4' : 'space-y-5'}>
      {/* ── Location ── */}
      <div className={sectionCls}>
        <label className={labelCls}>
          {!compact && <MapPin size={14} className="text-primary" />}
          Location
          <span className="text-xs text-muted-foreground font-normal ml-1">(countries)</span>
        </label>

        {/* Selected countries */}
        {value.countries.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {value.countries.map((code) => {
              const c = COUNTRIES.find((x) => x.code === code);
              return (
                <span
                  key={code}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary border border-primary/20
                             rounded-md text-xs font-medium"
                >
                  {c?.flag} {c?.name ?? code}
                  <button
                    type="button"
                    onClick={() => removeCountry(code)}
                    className="ml-0.5 hover:text-red-400 transition-colors"
                  >
                    <X size={11} />
                  </button>
                </span>
              );
            })}
          </div>
        )}

        {/* Country search dropdown */}
        <div className="relative" style={{ zIndex: countryDropdownOpen ? 50 : 'auto' }}>
          <div className="relative">
            <input
              type="text"
              value={countrySearch}
              onChange={(e) => {
                setCountrySearch(e.target.value);
                setCountryDropdownOpen(true);
              }}
              onFocus={() => setCountryDropdownOpen(true)}
              className={inputCls}
              placeholder="Search countries..."
            />
            <ChevronDown
              size={14}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
            />
          </div>

          {countryDropdownOpen && filteredCountries.length > 0 && (
            <>
              {/* Backdrop to close dropdown */}
              <div className="fixed inset-0 z-40" onClick={() => setCountryDropdownOpen(false)} />

              <div className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto bg-popover border border-border rounded-lg shadow-lg">
                {filteredCountries.map((c) => (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => {
                      addCountry(c.code);
                      setCountryDropdownOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-muted/50 transition-colors
                               flex items-center gap-2"
                  >
                    <span>{c.flag}</span>
                    <span>{c.name}</span>
                    <span className="text-xs text-muted-foreground ml-auto">{c.code}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {value.countries.length === 0 && (
          <p className="text-[11px] text-muted-foreground/60">
            No countries selected — Meta will use Advantage+ broad targeting
          </p>
        )}
      </div>

      {/* ── Age Range ── */}
      <div className={sectionCls}>
        <label className={labelCls}>
          {!compact && <Calendar size={14} className="text-primary" />}
          Age Range
        </label>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <label className="block text-[11px] text-muted-foreground mb-1">Min Age</label>
            <input
              type="number"
              min={18}
              max={value.ageMax}
              value={value.ageMin}
              onChange={(e) => {
                const v = Math.max(18, Math.min(Number(e.target.value), value.ageMax));
                update({ ageMin: v });
              }}
              className={inputCls}
            />
          </div>
          <span className="text-muted-foreground mt-5">—</span>
          <div className="flex-1">
            <label className="block text-[11px] text-muted-foreground mb-1">Max Age</label>
            <input
              type="number"
              min={value.ageMin}
              max={65}
              value={value.ageMax}
              onChange={(e) => {
                const v = Math.max(value.ageMin, Math.min(Number(e.target.value), 65));
                update({ ageMax: v });
              }}
              className={inputCls}
            />
          </div>
        </div>
      </div>

      {/* ── Gender ── */}
      <div className={sectionCls}>
        <label className={labelCls}>
          {!compact && <Users size={14} className="text-primary" />}
          Gender
        </label>
        <div className="flex gap-2">
          {([
            { value: 'all' as const, label: 'All' },
            { value: 'male' as const, label: 'Male' },
            { value: 'female' as const, label: 'Female' },
          ]).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => update({ gender: opt.value })}
              className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                value.gender === opt.value
                  ? 'bg-primary/10 text-primary border-primary/30'
                  : 'bg-muted/30 text-muted-foreground border-border hover:bg-muted/50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
