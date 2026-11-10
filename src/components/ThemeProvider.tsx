import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { DEFAULT_PRIMARY, generatePalette } from '../lib/theme';
import type { ThemePalette } from '../lib/theme';
import { readVisualStyle, visualStyleTokens } from '../lib/visual-style';
import type { VisualStyle } from '../lib/visual-style';
import type { ThemeTokens } from '../lib/theme';

const ThemeContext = createContext<{
  palette: ThemePalette;
  setPrimary: (hex: string) => void;
  tokens: ThemeTokens;
  visualStyle: VisualStyle;
  setVisualStyle: (style: VisualStyle) => void;
} | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [visualStyle, setVisualStyle] = useState(() => readVisualStyle(window.location.search));
  const [palette, setPalette] = useState(() => {
    const input = new URLSearchParams(window.location.search).get('theme');
    try {
      return generatePalette(input ?? DEFAULT_PRIMARY);
    } catch {
      return generatePalette(DEFAULT_PRIMARY);
    }
  });
  const tokens = useMemo(
    () => visualStyleTokens(palette.tokens, visualStyle),
    [palette, visualStyle],
  );
  const value = useMemo(
    () => ({
      palette,
      tokens,
      visualStyle,
      setVisualStyle,
      setPrimary: (hex: string) => setPalette(generatePalette(hex)),
    }),
    [palette, tokens, visualStyle],
  );
  useEffect(() => {
    const restoreStyle = () => setVisualStyle(readVisualStyle(window.location.search));
    window.addEventListener('popstate', restoreStyle);
    return () => window.removeEventListener('popstate', restoreStyle);
  }, []);
  useLayoutEffect(() => {
    const url = new URL(window.location.href);
    if (palette.primary === DEFAULT_PRIMARY) url.searchParams.delete('theme');
    else url.searchParams.set('theme', palette.primary.slice(1));
    if (visualStyle === 'vivid') url.searchParams.set('style', 'vivid');
    else url.searchParams.delete('style');
    window.history.replaceState(window.history.state, '', url);
    const root = document.documentElement;
    const oldStyle = root.getAttribute('data-visual-style');
    root.dataset.visualStyle = visualStyle;
    const previous = Object.keys(tokens).map((name) => [name, root.style.getPropertyValue(name)]);
    for (const [name, color] of Object.entries(tokens)) root.style.setProperty(name, color);
    const arrow = `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${tokens['--color-muted']}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>`)}")`;
    const oldArrow = root.style.getPropertyValue('--select-chevron');
    root.style.setProperty('--select-chevron', arrow);
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const oldMeta = meta?.content;
    if (meta) meta.content = tokens['--color-action'];
    const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    const oldIcon = icon?.getAttribute('href');
    if (icon && (palette.primary !== DEFAULT_PRIMARY || visualStyle === 'vivid')) {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><title>Астрон</title><rect width="64" height="64" rx="18" fill="${tokens['--color-action']}"/><text x="32" y="45" text-anchor="middle" font-family="Arial, sans-serif" font-size="42" font-weight="700" fill="${tokens['--color-on-action']}">А</text></svg>`;
      icon.href = `data:image/svg+xml,${encodeURIComponent(svg)}`;
    }
    return () => {
      if (oldStyle) root.setAttribute('data-visual-style', oldStyle);
      else root.removeAttribute('data-visual-style');
      for (const [name, color] of previous) {
        if (color) root.style.setProperty(name, color);
        else root.style.removeProperty(name);
      }
      if (oldArrow) root.style.setProperty('--select-chevron', oldArrow);
      else root.style.removeProperty('--select-chevron');
      if (meta && oldMeta) meta.content = oldMeta;
      if (icon && oldIcon) icon.setAttribute('href', oldIcon);
    };
  }, [palette, tokens, visualStyle]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('ThemeProvider is required.');
  return context;
}
