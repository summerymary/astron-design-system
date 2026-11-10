import type { ThemeTokens } from './theme';

export type VisualStyle = 'astron' | 'vivid';

export function readVisualStyle(search: string): VisualStyle {
  // The retired Minimal/Spectrum routes return to Astron; its source is archived separately.
  return new URLSearchParams(search).get('style') === 'vivid' ? 'vivid' : 'astron';
}

// A brighter Astron palette. Layout, semantic statuses and membership colours stay shared.
export const VIVID_OVERRIDES = {
  '--color-accent': '#B32D3D',
  '--color-accent-hover': '#942235',
  '--color-accent-pressed': '#761A2B',
  '--color-accent-soft': '#FDEDF0',
  '--color-accent-soft-hover': '#F8DCE3',
  '--color-accent-line': '#A34867',
  '--color-on-accent': '#FFFFFF',
  '--color-action': '#B32D3D',
  '--color-action-hover': '#942235',
  '--color-action-pressed': '#761A2B',
  '--color-action-border': '#942235',
  '--color-on-action': '#FFFFFF',
  '--color-ink': '#151922',
  '--color-text': '#303947',
  '--color-muted': '#4D5966',
  '--color-subtle': '#4D5966',
  '--color-canvas': '#E8EBF1',
  '--color-stage': '#DDE2EB',
  '--color-surface': '#FFFFFF',
  '--color-surface-subtle': '#F1F3F7',
  '--color-surface-muted': '#DCE2EB',
  '--color-line': '#A7AFBC',
  '--color-control-border': '#754659',
  '--color-chart': '#B32D3D',
  '--color-skeleton': '#DAD6DF',
  '--color-skeleton-highlight': '#F9F7FA',
} satisfies Partial<ThemeTokens>;

export function visualStyleTokens(tokens: ThemeTokens, style: VisualStyle): ThemeTokens {
  return style === 'vivid' ? { ...tokens, ...VIVID_OVERRIDES } : tokens;
}

export function appearanceSearch(primary: string, style: VisualStyle) {
  const params = new URLSearchParams({ theme: primary.slice(1) });
  if (style === 'vivid') params.set('style', 'vivid');
  return `?${params}`;
}
