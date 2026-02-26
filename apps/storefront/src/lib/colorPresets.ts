/**
 * Color Presets — shared palette definitions for sellpage editor.
 *
 * Extracted from storeTheme.ts so the portal (sellpage editor) can import
 * presets without pulling in storefront theme utilities.
 */

export interface ColorPreset {
  primary: string;
  hover: string;
  light: string;
  text: string;
}

export const COLOR_PRESETS: Record<string, ColorPreset> = {
  purple: { primary: '#7c3aed', hover: '#6d28d9', light: '#ede9fe', text: '#6d28d9' },
  blue:   { primary: '#2563eb', hover: '#1d4ed8', light: '#dbeafe', text: '#1d4ed8' },
  green:  { primary: '#16a34a', hover: '#15803d', light: '#dcfce7', text: '#15803d' },
  red:    { primary: '#dc2626', hover: '#b91c1c', light: '#fee2e2', text: '#b91c1c' },
  amber:  { primary: '#d97706', hover: '#b45309', light: '#fef3c7', text: '#b45309' },
  rose:   { primary: '#e11d48', hover: '#be123c', light: '#ffe4e6', text: '#be123c' },
  indigo: { primary: '#4f46e5', hover: '#4338ca', light: '#e0e7ff', text: '#4338ca' },
  teal:   { primary: '#0d9488', hover: '#0f766e', light: '#ccfbf1', text: '#0f766e' },
};
