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
  '--color-accent-line': '#D692A0',
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
  '--color-canvas': '#F5F4F7',
  '--color-stage': '#EBE8EF',
  '--color-surface': '#FFFFFF',
  '--color-surface-subtle': '#FAF8FA',
  '--color-surface-muted': '#F0EDF2',
  '--color-line': '#D2D3DC',
  '--color-control-border': '#747E8C',
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
