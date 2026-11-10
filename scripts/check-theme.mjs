import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

// The production module has no DOM or dependency imports. Exercise that exact code.
const source = await readFile(new URL('../src/lib/theme.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText;
const {
  generatePalette,
  normalizeHex,
  contrastRatio,
  paletteToCss,
  ASTRON_TOKENS,
  DEFAULT_PRIMARY,
  THEME_PRESETS,
} = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
assert.equal(normalizeHex(' #abc '), '#AABBCC');
assert.equal(normalizeHex('606a5c'), '#606A5C');
for (const invalid of ['', '#1234', 'red', '#GG0033', 'rgb(0,0,0)']) {
  assert.equal(normalizeHex(invalid), null);
  assert.throws(() => generatePalette(invalid));
}
assert.equal(contrastRatio('#000', '#fff'), 21);
assert.equal(contrastRatio('#fff', '#000'), 21);
assert.equal(contrastRatio('#123456', '#123456'), 1);
assert.deepEqual(generatePalette(DEFAULT_PRIMARY).tokens, ASTRON_TOKENS);
// The alternative skin must never mutate the saved club palette or repurpose statuses.
const styleSource = await readFile(new URL('../src/lib/visual-style.ts', import.meta.url), 'utf8');
const styleCompiled = ts.transpileModule(styleSource, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText;
const { visualStyleTokens, readVisualStyle, appearanceSearch } = await import(
  `data:text/javascript;base64,${Buffer.from(styleCompiled).toString('base64')}`
);
assert.equal(readVisualStyle(''), 'astron');
assert.equal(readVisualStyle('?style=unknown'), 'astron');
assert.equal(readVisualStyle('?theme=F0FC03&style=spectrum'), 'spectrum');
assert.equal(readVisualStyle('?style=minimal'), 'spectrum');
for (const preset of THEME_PRESETS) {
  const original = generatePalette(preset.color).tokens;
  const snapshot = { ...original };
  const alternative = visualStyleTokens(original, 'spectrum');
  assert.equal(
    alternative['--color-action'],
    '#1D1D1F',
    'Minimal interface must use graphite actions',
  );
  assert.deepEqual(original, snapshot, 'Alternative mutated the original palette');
  assert.deepEqual(
    visualStyleTokens(original, 'astron'),
    snapshot,
    'Original palette did not restore',
  );
  for (const key of Object.keys(original).filter((key) =>
    /success|warning|danger|paused|info/.test(key),
  )) {
    assert.equal(alternative[key], original[key], `${key}: status semantics changed`);
  }
  for (const surface of ['--color-surface', '--color-canvas', '--color-surface-muted']) {
    assert.ok(contrastRatio(alternative['--color-muted'], alternative[surface]) >= 4.5);
    assert.ok(contrastRatio(alternative['--color-ink'], alternative[surface]) >= 4.5);
  }
  assert.ok(contrastRatio(alternative['--color-on-action'], alternative['--color-action']) >= 4.5);
  assert.ok(
    contrastRatio(alternative['--color-control-border'], alternative['--color-surface']) >= 3,
  );
  const url = new URL(`https://example.com/${appearanceSearch(preset.color, 'spectrum')}`);
  assert.equal(readVisualStyle(url.search), 'spectrum');
  assert.equal(url.searchParams.get('theme'), preset.color.slice(1));
}
console.log(
  'Alternative visual style: contrast, original palette, status semantics and shared URLs passed.',
);
const fallback = await readFile(new URL('../src/styles/tokens.css', import.meta.url), 'utf8');
for (const [key, value] of Object.entries(ASTRON_TOKENS)) {
  const css = fallback.match(new RegExp(`${key}:\\s*([^;]+);`))?.[1];
  assert.equal(
    css?.startsWith('var(') ? ASTRON_TOKENS[css.slice(4, -1)] : css?.toUpperCase(),
    value,
    `${key}: default drift`,
  );
}
const detached = generatePalette(DEFAULT_PRIMARY);
detached.tokens['--color-accent'] = '#000000';
assert.equal(generatePalette(DEFAULT_PRIMARY).tokens['--color-accent'], DEFAULT_PRIMARY);

const inputs = [
  '#FFFFFF',
  '#000000',
  '#111111',
  '#888888',
  '#FF0000',
  '#00FF00',
  '#0000FF',
  '#FFFF00',
  '#00FFFF',
  '#FF00FF',
  ...THEME_PRESETS.filter((p) => p.color !== DEFAULT_PRIMARY).map((p) => p.color),
  '#F6C445',
];
let seed = 48271;
for (let i = 0; i < 1000; i++) {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  inputs.push(`#${(seed & 0xffffff).toString(16).padStart(6, '0')}`);
}
const semantic = Object.keys(ASTRON_TOKENS).filter((key) =>
  /--color-(success|warning|danger|info|paused)/.test(key),
);
for (const input of inputs) {
  const result = generatePalette(input),
    t = result.tokens;
  assert.equal(result.primary, input.toUpperCase());
  assert.deepEqual(generatePalette(input), result, `${input}: deterministic`);
  for (const value of Object.values(t)) assert.match(value, /^#[0-9A-F]{6}$/);
  for (const key of semantic) assert.equal(t[key], ASTRON_TOKENS[key]);
  for (const key of ['--color-action', '--color-action-hover', '--color-action-pressed']) {
    assert.ok(
      contrastRatio(t[key], t['--color-on-action']) >= 4.5,
      `${input}: button text on ${key}`,
    );
    assert.ok(
      contrastRatio(t[key], t['--color-action-border']) >= 3 || result.appearance === 'standard',
      `${input}: citrus button edge`,
    );
  }
  const surfaces = [
    '--color-surface',
    '--color-canvas',
    '--color-surface-muted',
    '--color-surface-subtle',
    '--color-accent-soft',
    '--color-accent-soft-hover',
  ];
  for (const key of ['--color-accent', '--color-accent-hover', '--color-accent-pressed']) {
    assert.ok(contrastRatio(t[key], t['--color-on-accent']) >= 4.5, `${input}: white on ${key}`);
    for (const bg of surfaces)
      assert.ok(contrastRatio(t[key], t[bg]) >= 4.5, `${input}: ${key} on ${bg}`);
  }
  for (const bg of surfaces) {
    for (const key of ['--color-ink', '--color-text', '--color-muted', '--color-subtle'])
      assert.ok(contrastRatio(t[key], t[bg]) >= 4.5, `${input}: ${key} on ${bg}`);
    assert.ok(contrastRatio(t['--color-control-border'], t[bg]) >= 3, `${input}: control on ${bg}`);
  }
  assert.ok(
    contrastRatio('#FFFFFF', t['--color-accent-hover']) >
      contrastRatio('#FFFFFF', t['--color-accent']),
  );
  assert.ok(
    contrastRatio('#FFFFFF', t['--color-accent-pressed']) >
      contrastRatio('#FFFFFF', t['--color-accent-hover']),
  );
  assert.ok(paletteToCss(result).includes(`--color-accent: ${t['--color-accent']};`));
}
const lime = generatePalette('#F0FC03');
assert.equal(lime.appearance, 'citrus');
assert.equal(lime.tokens['--color-action'], '#F0FC03');
assert.equal(lime.tokens['--color-accent'], '#243341');
assert.equal(lime.tokens['--color-on-action'], '#243341');
console.log(
  `Theme checks passed: exact Astron defaults, input validation, ${inputs.length} palettes, text/control contrast, states, fixed statuses and CSS export.`,
);
