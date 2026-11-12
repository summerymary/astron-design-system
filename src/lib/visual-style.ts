import { ASTRON_TOKENS } from './theme';
import type { ThemeTokens } from './theme';

export type VisualStyle = 'astron' | 'vivid';

export const THEME_OPTIONS = [
  { id: 'astron', name: 'Астрон', color: '#8A332C', style: 'astron' },
  { id: 'graphite', name: 'Графит', color: '#111111', style: 'astron' },
  { id: 'contrast', name: 'Контраст', color: '#8A332C', style: 'vivid' },
] as const;
export type ThemeId = (typeof THEME_OPTIONS)[number]['id'];

export function readVisualStyle(search: string): VisualStyle {
  // The retired Minimal/Spectrum routes return to Astron; its source is archived separately.
  return new URLSearchParams(search).get('style') === 'vivid' ? 'vivid' : 'astron';
}

// Astron colours with stronger contours; geometry and semantic colours are shared.
export const VIVID_OVERRIDES = {
  ...ASTRON_TOKENS,
  '--color-line': '#B8AEA6',
  '--color-control-border': '#746C63',
} satisfies Partial<ThemeTokens>;

export function visualStyleTokens(tokens: ThemeTokens, style: VisualStyle): ThemeTokens {
  return style === 'vivid' ? { ...tokens, ...VIVID_OVERRIDES } : tokens;
}

export function appearanceSearch(primary: string, style: VisualStyle) {
  const params = new URLSearchParams({ theme: primary.slice(1) });
  if (style === 'vivid') params.set('style', 'vivid');
  return `?${params}`;
}
