import type { ThemeTokens } from './theme';

export type VisualStyle = 'astron' | 'spectrum';

export function readVisualStyle(search: string): VisualStyle {
  return new URLSearchParams(search).get('style') === 'spectrum' ? 'spectrum' : 'astron';
}

// An original, Spectrum-inspired skin. Semantic statuses and club branding stay independent.
export const SPECTRUM_OVERRIDES = {
  '--color-accent': '#6B2737',
  '--color-accent-hover': '#541D2B',
  '--color-accent-pressed': '#3D1420',
  '--color-accent-soft': '#F6EFF1',
  '--color-accent-soft-hover': '#EFE2E6',
  '--color-accent-line': '#D8B9C0',
  '--color-on-accent': '#FFFFFF',
  '--color-action': '#6B2737',
  '--color-action-hover': '#541D2B',
  '--color-action-pressed': '#3D1420',
  '--color-action-border': '#6B2737',
  '--color-on-action': '#FFFFFF',
  '--color-ink': '#241E21',
  '--color-text': '#494145',
  '--color-muted': '#686064',
  '--color-subtle': '#686064',
  '--color-canvas': '#F8F7F7',
  '--color-stage': '#F0EDEE',
  '--color-surface': '#FFFFFF',
  '--color-surface-subtle': '#FCFAFB',
  '--color-surface-muted': '#F1EDEF',
  '--color-line': '#E7E2E4',
  '--color-control-border': '#90848A',
  '--color-chart': '#6B2737',
  '--color-skeleton': '#E7E2E4',
  '--color-skeleton-highlight': '#FCFAFB',
} satisfies Partial<ThemeTokens>;

export function visualStyleTokens(tokens: ThemeTokens, style: VisualStyle): ThemeTokens {
  return style === 'spectrum' ? { ...tokens, ...SPECTRUM_OVERRIDES } : tokens;
}

export function appearanceSearch(primary: string, style: VisualStyle) {
  const params = new URLSearchParams({ theme: primary.slice(1) });
  if (style === 'spectrum') params.set('style', style);
  return `?${params}`;
}
