import type { ThemeTokens } from './theme';

export type VisualStyle = 'astron' | 'spectrum';

export function readVisualStyle(search: string): VisualStyle {
  const value = new URLSearchParams(search).get('style');
  return value === 'minimal' || value === 'spectrum' ? 'spectrum' : 'astron';
}

// An original, Spectrum-inspired skin. Semantic statuses and club branding stay independent.
export const SPECTRUM_OVERRIDES = {
  '--color-accent': '#1D1D1F',
  '--color-accent-hover': '#343438',
  '--color-accent-pressed': '#000000',
  '--color-accent-soft': '#F0F0F2',
  '--color-accent-soft-hover': '#E4E4E7',
  '--color-accent-line': '#B8B8BE',
  '--color-on-accent': '#FFFFFF',
  '--color-action': '#1D1D1F',
  '--color-action-hover': '#343438',
  '--color-action-pressed': '#000000',
  '--color-action-border': '#1D1D1F',
  '--color-on-action': '#FFFFFF',
  '--color-ink': '#1D1D1F',
  '--color-text': '#424245',
  '--color-muted': '#6E6E73',
  '--color-subtle': '#6E6E73',
  '--color-canvas': '#FFFFFF',
  '--color-stage': '#F5F5F7',
  '--color-surface': '#FFFFFF',
  '--color-surface-subtle': '#FAFAFC',
  '--color-surface-muted': '#F2F2F4',
  '--color-line': '#E8E8ED',
  '--color-control-border': '#89898F',
  '--color-chart': '#536B60',
  '--color-skeleton': '#E8E8ED',
  '--color-skeleton-highlight': '#FAFAFC',
} satisfies Partial<ThemeTokens>;

export function visualStyleTokens(tokens: ThemeTokens, style: VisualStyle): ThemeTokens {
  return style === 'spectrum' ? { ...tokens, ...SPECTRUM_OVERRIDES } : tokens;
}

export function appearanceSearch(primary: string, style: VisualStyle) {
  const params = new URLSearchParams({ theme: primary.slice(1) });
  if (style === 'spectrum') params.set('style', 'minimal');
  return `?${params}`;
}
