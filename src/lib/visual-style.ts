import type { ThemeTokens } from './theme';

export type VisualStyle = 'astron' | 'vivid';

export const THEME_OPTIONS = [
  { id: 'astron', name: 'Астрон', color: '#8A332C', style: 'astron' },
  { id: 'graphite', name: 'Графит', color: '#111111', style: 'astron' },
  { id: 'contrast', name: 'Тёмная', color: '#202020', style: 'vivid' },
] as const;
export type ThemeId = (typeof THEME_OPTIONS)[number]['id'];

export function readVisualStyle(search: string): VisualStyle {
  // The retired Minimal/Spectrum routes return to Astron; its source is archived separately.
  return new URLSearchParams(search).get('style') === 'vivid' ? 'vivid' : 'astron';
}

// Charcoal surfaces, white text and burgundy controls with stronger contours. Semantic hues and component geometry remain shared with Astron.
export const VIVID_OVERRIDES = {
  '--color-accent': '#FFB4C4',
  '--color-accent-hover': '#FFC7D2',
  '--color-accent-pressed': '#F0A3AD',
  '--color-accent-soft': '#452831',
  '--color-accent-soft-hover': '#512E39',
  '--color-accent-line': '#BF8292',
  '--color-on-accent': '#202020',
  '--color-action': '#963646',
  '--color-action-hover': '#A94153',
  '--color-action-pressed': '#7E2938',
  '--color-action-border': '#EDABBA',
  '--color-on-action': '#FFFFFF',
  '--color-ink': '#FFFFFF',
  '--color-text': '#EEEEEE',
  '--color-muted': '#BFBFBF',
  '--color-subtle': '#BFBFBF',
  '--color-canvas': '#202020',
  '--color-stage': '#181818',
  '--color-surface': '#2A2A2A',
  '--color-surface-subtle': '#242424',
  '--color-surface-muted': '#343434',
  '--color-line': '#9B7A84',
  '--color-control-border': '#C38B9A',
  '--color-success': '#A4D8B4',
  '--color-success-bg': '#263B31',
  '--color-warning': '#F4D187',
  '--color-warning-bg': '#40361F',
  '--color-danger': '#FFB3AC',
  '--color-danger-bg': '#442B34',
  '--color-info': '#B7D1FF',
  '--color-info-bg': '#273348',
  '--color-paused': '#D6C0F1',
  '--color-paused-bg': '#382D45',
  '--color-chart': '#BB6376',
  '--color-skeleton': '#424242',
  '--color-skeleton-highlight': '#565656',
} satisfies ThemeTokens;

export function visualStyleTokens(tokens: ThemeTokens, style: VisualStyle): ThemeTokens {
  return style === 'vivid' ? { ...tokens, ...VIVID_OVERRIDES } : tokens;
}

export function appearanceSearch(primary: string, style: VisualStyle) {
  const params = new URLSearchParams({ theme: primary.slice(1) });
  if (style === 'vivid') params.set('style', 'vivid');
  return `?${params}`;
}
