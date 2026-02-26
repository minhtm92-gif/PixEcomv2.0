/**
 * Store Theme — CSS custom property generation for storefront pages.
 *
 * Sellpage admins pick a preset name (e.g. "blue") or enter a hex value.
 * The storefront applies CSS vars: --sp-primary, --sp-primary-hover, --sp-primary-light.
 * Components use Tailwind arbitrary values: bg-[var(--sp-primary)] etc.
 *
 * COLOR_PRESETS live in @/lib/colorPresets to decouple the sellpage editor
 * (portal) from storefront theme utilities.
 */

import { COLOR_PRESETS, type ColorPreset } from './colorPresets';
export type { ColorPreset } from './colorPresets';

const DEFAULT_COLOR = COLOR_PRESETS.purple;

/**
 * Darken a hex color by a factor (0-1).
 */
function darken(hex: string, factor: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const f = 1 - factor;
  return `#${Math.round(r * f).toString(16).padStart(2, '0')}${Math.round(g * f).toString(16).padStart(2, '0')}${Math.round(b * f).toString(16).padStart(2, '0')}`;
}

/**
 * Lighten a hex color towards white.
 */
function lighten(hex: string, factor: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `#${Math.round(r + (255 - r) * factor).toString(16).padStart(2, '0')}${Math.round(g + (255 - g) * factor).toString(16).padStart(2, '0')}${Math.round(b + (255 - b) * factor).toString(16).padStart(2, '0')}`;
}

/**
 * Resolve a preset name or hex string to a ColorPreset.
 */
export function resolveColor(value: string | null | undefined): ColorPreset {
  if (!value) return DEFAULT_COLOR;

  // Check preset by name
  const lower = value.toLowerCase();
  if (COLOR_PRESETS[lower]) return COLOR_PRESETS[lower];

  // Treat as hex color
  if (/^#[0-9a-f]{6}$/i.test(value)) {
    return {
      primary: value,
      hover: darken(value, 0.15),
      light: lighten(value, 0.85),
      text: darken(value, 0.15),
    };
  }

  return DEFAULT_COLOR;
}

/**
 * Generate CSS custom properties for the color preset.
 */
export function themeVars(color: ColorPreset): React.CSSProperties {
  return {
    '--sp-primary': color.primary,
    '--sp-primary-hover': color.hover,
    '--sp-primary-light': color.light,
    '--sp-primary-text': color.text,
  } as React.CSSProperties;
}
