export const DEFAULT_PRIMARY = '#8A332C';
export const THEME_PRESETS = [
  { name: 'Астрон', color: DEFAULT_PRIMARY },
  { name: 'Глубокий синий', color: '#173B70' },
  { name: 'Тёмный лес', color: '#164B3B' },
  { name: 'Лайм', color: '#F0FC03' },
  { name: 'Графит', color: '#111111' },
];

// Keep the established Astron palette exact; tokens.css is its first-paint fallback.
export const ASTRON_TOKENS = {
  '--color-accent': '#8A332C',
  '--color-accent-hover': '#722820',
  '--color-accent-pressed': '#5B1F19',
  '--color-accent-soft': '#F6EBE6',
  '--color-accent-soft-hover': '#EEDBD2',
  '--color-accent-line': '#D7B0A2',
  '--color-on-accent': '#FFFFFF',
  '--color-action': '#8A332C',
  '--color-action-hover': '#722820',
  '--color-action-pressed': '#5B1F19',
  '--color-action-border': '#8A332C',
  '--color-on-action': '#FFFFFF',
  '--color-ink': '#181C24',
  '--color-text': '#3D4652',
  '--color-muted': '#606A5C',
  '--color-subtle': '#606A5C',
  '--color-canvas': '#F4F5F7',
  '--color-stage': '#E8EBEF',
  '--color-surface': '#FFFFFF',
  '--color-surface-subtle': '#FAFBFC',
  '--color-surface-muted': '#EDF0F3',
  '--color-line': '#DCE1E7',
  '--color-control-border': '#7C8794',
  '--color-success': '#276444',
  '--color-success-bg': '#EAF4EE',
  '--color-warning': '#83520D',
  '--color-warning-bg': '#FFF3DC',
  '--color-danger': '#B42318',
  '--color-danger-bg': '#FFF0ED',
  '--color-info': '#3E5E89',
  '--color-info-bg': '#EEF2F8',
  '--color-paused': '#6B547E',
  '--color-paused-bg': '#F3EEF6',
  '--color-chart': '#B16B59',
  '--color-skeleton': '#DCE1E7',
  '--color-skeleton-highlight': '#F7F8FA',
};

export type ThemeToken = keyof typeof ASTRON_TOKENS;
export type ThemeTokens = Record<ThemeToken, string>;
export interface ThemePalette {
  primary: string;
  adjusted: boolean;
  appearance: 'standard' | 'citrus';
  tokens: ThemeTokens;
}
type Lch = { l: number; c: number; h: number };
const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v));

export function normalizeHex(input: string): string | null {
  const hex = input.trim().replace(/^#/, '');
  if (/^[\da-f]{3}$/i.test(hex)) return `#${[...hex].map((n) => n + n).join('')}`.toUpperCase();
  return /^[\da-f]{6}$/i.test(hex) ? `#${hex.toUpperCase()}` : null;
}

function linearChannels(hex: string) {
  const normalized = normalizeHex(hex);
  if (!normalized) throw new Error('Нужен цвет в формате HEX, например #8A332C.');
  return [1, 3, 5].map((i) => {
    const value = parseInt(normalized.slice(i, i + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
}

export function contrastRatio(foreground: string, background: string) {
  const luminance = (hex: string) => {
    const [r, g, b] = linearChannels(hex);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const a = luminance(foreground),
    b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

// Oklab/sRGB conversion; chroma is reduced to fit sRGB, keeping hue and lightness.
function toLch(hex: string): Lch {
  const [r, g, b] = linearChannels(hex);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const y = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const c = Math.hypot(a, y);
  return {
    l: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    c: c < 0.00001 ? 0 : c,
    h: c < 0.00001 ? 0 : Math.atan2(y, a),
  };
}

function linearRgb({ l: lightness, c, h }: Lch) {
  const a = c * Math.cos(h),
    b = c * Math.sin(h);
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

function toHex(color: Lch) {
  const inGamut = (rgb: number[]) =>
    rgb.every((value) => value >= -0.0000001 && value <= 1.0000001);
  let rgb = linearRgb(color);
  if (!inGamut(rgb)) {
    let low = 0,
      high = color.c;
    for (let i = 0; i < 18; i++) {
      const mid = (low + high) / 2;
      if (inGamut(linearRgb({ ...color, c: mid }))) low = mid;
      else high = mid;
    }
    rgb = linearRgb({ ...color, c: low });
  }
  return `#${rgb
    .map((value) => {
      const v = clamp(value);
      const channel = v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
      return Math.round(clamp(channel) * 255)
        .toString(16)
        .padStart(2, '0');
    })
    .join('')}`.toUpperCase();
}

function readableTone(color: Lch, backgrounds: string[], minimum: number) {
  // Check rounded HEX values too; do not round the contrast before comparing.
  for (let l = clamp(color.l); l >= 0; l -= 0.005) {
    const hex = toHex({ ...color, l });
    if (backgrounds.every((bg) => contrastRatio(hex, bg) >= minimum)) return hex;
  }
  return '#000000';
}

export function generatePalette(input: string): ThemePalette {
  const primary = normalizeHex(input);
  if (!primary) throw new Error('Нужен цвет в формате HEX, например #8A332C.');
  if (primary === DEFAULT_PRIMARY)
    return { primary, adjusted: false, appearance: 'standard', tokens: { ...ASTRON_TOKENS } };
  const source = toLch(primary);
  const degrees = ((source.h * 180) / Math.PI + 360) % 360;
  const citrus = source.l > 0.82 && source.c > 0.1 && degrees >= 90 && degrees <= 125;
  // Bright citrus uses a cool graphite companion instead of muddy olive neutrals.
  const family = citrus ? toLch('#243341') : source;
  const neutralChroma = citrus ? 0.015 : Math.min(source.c * 0.12, 0.016);
  const tone = (l: number, c: number) => toHex({ l, c, h: family.h });
  const soft = tone(0.965, citrus ? 0.012 : Math.min(source.c * 0.2, 0.028));
  const softHover = tone(0.94, citrus ? 0.018 : Math.min(source.c * 0.22, 0.035));
  const canvas = tone(0.982, neutralChroma * 0.5);
  const surfaceSubtle = tone(0.993, neutralChroma * 0.25);
  const surfaceMuted = tone(0.96, neutralChroma * 0.7);
  const backgrounds = ['#FFFFFF', soft, softHover, canvas, surfaceSubtle, surfaceMuted];
  const accent = readableTone(
    { ...family, l: citrus ? family.l : clamp(family.l, 0.32, 0.82) },
    backgrounds,
    4.7,
  );
  const working = toLch(accent);
  const hover = readableTone({ ...working, l: Math.max(0.06, working.l - 0.06) }, backgrounds, 4.7);
  const pressed = readableTone(
    { ...working, l: Math.max(0.03, working.l - 0.12) },
    backgrounds,
    4.7,
  );
  const ink = tone(0.24, neutralChroma);
  const text = readableTone({ l: 0.37, c: neutralChroma, h: family.h }, backgrounds, 7);
  const muted = readableTone({ l: 0.51, c: neutralChroma, h: family.h }, backgrounds, 4.7);
  const line = tone(0.88, neutralChroma * 0.65);
  return {
    primary,
    adjusted: primary !== accent,
    appearance: citrus ? 'citrus' : 'standard',
    tokens: {
      ...ASTRON_TOKENS,
      '--color-accent': accent,
      '--color-accent-hover': hover,
      '--color-accent-pressed': pressed,
      '--color-action': citrus ? primary : accent,
      '--color-action-hover': citrus ? toHex({ ...source, l: source.l - 0.025 }) : hover,
      '--color-action-pressed': citrus ? toHex({ ...source, l: source.l - 0.05 }) : pressed,
      '--color-action-border': accent,
      '--color-on-action': citrus ? accent : '#FFFFFF',
      '--color-accent-soft': soft,
      '--color-accent-soft-hover': softHover,
      '--color-accent-line': tone(0.75, Math.min(source.c * 0.4, 0.07)),
      '--color-ink': ink,
      '--color-text': text,
      '--color-muted': muted,
      '--color-subtle': muted,
      '--color-canvas': canvas,
      '--color-stage': tone(0.94, neutralChroma * 0.8),
      '--color-surface-subtle': surfaceSubtle,
      '--color-surface-muted': surfaceMuted,
      '--color-line': line,
      '--color-control-border': readableTone(
        { l: 0.62, c: neutralChroma, h: family.h },
        backgrounds,
        3.15,
      ),
      '--color-chart': tone(Math.min(0.7, working.l + 0.1), working.c * 0.75),
      '--color-skeleton': line,
      '--color-skeleton-highlight': canvas,
    },
  };
}

export function paletteToCss(palette: ThemePalette) {
  return `:root {\n${Object.entries(palette.tokens)
    .map(([name, value]) => `  ${name}: ${value};`)
    .join('\n')}\n}`;
}
