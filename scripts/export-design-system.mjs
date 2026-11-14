import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { resolve, relative, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import ts from 'typescript';

const root = resolve(import.meta.dirname, '..');
const check = process.argv.includes('--check');
const read = (file) => readFile(resolve(root, file), 'utf8');
const cache = new Map();
async function moduleURL(file) {
  if (cache.has(file)) return cache.get(file);
  let js = ts.transpileModule(await read(file), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  }).outputText;
  for (const match of [...js.matchAll(/from ['"]([^'"]+)['"]/g)]) {
    if (!match[1].startsWith('.')) throw new Error('Only local source modules may be exported');
    const dependency = relative(root, resolve(root, dirname(file), match[1] + '.ts'));
    js = js.replace(match[0], `from '${await moduleURL(dependency)}'`);
  }
  const url = 'data:text/javascript;base64,' + Buffer.from(js).toString('base64');
  cache.set(file, url);
  return url;
}
const load = async (file) => import(await moduleURL(file));
const { generatePalette } = await load('src/lib/theme.ts');
const { THEME_OPTIONS, visualStyleTokens } = await load('src/lib/visual-style.ts');
const { UI_RULES, UI_METRICS } = await load('src/design-system/registry.ts');
const { membershipKinds } = await load('src/data/membership-kinds.ts');
const { TRAINING_INTENSITIES, OCCUPANCY_SCALE } = await load('src/lib/schedule.ts');
const base = Object.fromEntries(
  [...(await read('src/styles/tokens.css')).matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [
    m[1],
    m[2].trim(),
  ]),
);
const contrastCSS =
  (await read('src/styles/components.css')).match(
    /:root\[data-visual-style='vivid'\]\s*\{([^}]+)\}/,
  )?.[1] || '';
const contrastRoot = Object.fromEntries(
  [...contrastCSS.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]),
);
const themes = Object.fromEntries(
  THEME_OPTIONS.map((option) => [
    option.id,
    {
      name: option.name,
      colorScheme:
        option.style === 'vivid'
          ? contrastCSS.match(/\bcolor-scheme:\s*(\w+)/)?.[1] || 'light'
          : 'light',
      tokens: {
        ...base,
        ...visualStyleTokens(generatePalette(option.color).tokens, option.style),
        ...(option.style === 'vivid' ? contrastRoot : {}),
      },
    },
  ]),
);
const contextual = [];
for (const folder of ['src/styles', 'src/components']) {
  for (const name of (await readdir(resolve(root, folder)))
    .filter((n) => n.endsWith('.css'))
    .sort()) {
    const file = folder + '/' + name;
    if (file === 'src/styles/tokens.css') continue;
    const css = (await read(file)).replace(/\/\*[\s\S]*?\*\//g, '');
    // CSS declaration scanner: semicolons inside quoted strings/functions are not delimiters.
    const regex = /(--[\w-]+)\s*:/g;
    for (const match of css.matchAll(regex)) {
      let i = match.index + match[0].length,
        start = i,
        depth = 0,
        quote = '';
      for (; i < css.length; i++) {
        const ch = css[i];
        if (ch === '\\') {
          i++;
          continue;
        }
        if (quote) {
          if (ch === quote) quote = '';
          continue;
        }
        if (ch === '"' || ch === "'") {
          quote = ch;
          continue;
        }
        if (ch === '(') depth++;
        if (ch === ')') depth--;
        if (!depth && (ch === ';' || ch === '}')) break;
      }
      const value = css.slice(start, i).trim();
      if (!contextual.some((v) => v.name === match[1] && v.value === value && v.source === file))
        contextual.push({ name: match[1], value, source: file });
    }
  }
}
const runtimeVariables = [];
for (const folder of ['src/components', 'src/pages']) {
  for (const name of (await readdir(resolve(root, folder)))
    .filter((n) => n.endsWith('.tsx'))
    .sort()) {
    const file = folder + '/' + name,
      source = await read(file);
    const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const walk = (node) => {
      if (
        ts.isPropertyAssignment(node) &&
        ts.isStringLiteral(node.name) &&
        node.name.text.startsWith('--')
      )
        runtimeVariables.push({
          name: node.name.text,
          expression: node.initializer.getText(tree),
          source: file,
        });
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === 'setProperty' &&
        ts.isStringLiteral(node.arguments[0]) &&
        node.arguments[0].text.startsWith('--')
      )
        runtimeVariables.push({
          name: node.arguments[0].text,
          expression: node.arguments[1].getText(tree),
          source: file,
        });
      ts.forEachChild(node, walk);
    };
    walk(tree);
  }
}
const data = {
  schemaVersion: 1,
  description:
    'Generated from the application. Contextual declarations are not global defaults; keep their original scope.',
  base,
  themes,
  metrics: UI_METRICS,
  semantics: { membershipKinds, intensity: TRAINING_INTENSITIES, occupancy: OCCUPANCY_SCALE },
  contextualDeclarations: contextual,
  runtimeVariables,
  rules: UI_RULES,
};
const css =
  '/* Generated by pnpm docs:export. Tokens only; component CSS and behaviour live in src/. */\n' +
  Object.entries(themes)
    .map(
      ([id, theme], index) =>
        `${index === 0 ? ':root,\n' : ''}:root[data-astron-theme="${id}"] {\n` +
        `  color-scheme: ${theme.colorScheme};\n` +
        Object.entries(theme.tokens)
          .map(([key, value]) => `  ${key}: ${value};`)
          .join('\n') +
        '\n}',
    )
    .join('\n\n') +
  '\n';
const esc = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
const inline = (text) =>
  esc(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\((https:\/\/[^)]+)\)/g, '<a href="$2">$1</a>');
function markdown(source) {
  const lines = source.split('\n');
  let html = '',
    list = '',
    code = null;
  const closeList = () => {
    if (list) html += `</${list}>`;
    list = '';
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('```')) {
      closeList();
      if (code !== null) {
        html += '<pre><code>' + esc(code.join('\n')) + '</code></pre>';
        code = null;
      } else code = [];
      continue;
    }
    if (code !== null) {
      code.push(line);
      continue;
    }
    if (!line.trim()) {
      closeList();
      continue;
    }
    const heading = /^(#{1,3}) (.*)/.exec(line);
    if (heading) {
      closeList();
      html += `<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`;
      continue;
    }
    if (line.startsWith('|')) {
      closeList();
      const rows = [];
      while (i < lines.length && lines[i].startsWith('|')) rows.push(lines[i++]);
      i--;
      html +=
        '<div class="table-scroll"><table>' +
        rows
          .filter((row) => !/^\|[\s:|-]+\|$/.test(row))
          .map(
            (row, idx) =>
              '<tr>' +
              row
                .slice(1, -1)
                .split(/\|(?=(?:[^`]*`[^`]*`)*[^`]*$)/)
                .map(
                  (cell) => `<${idx ? 'td' : 'th'}>${inline(cell.trim())}</${idx ? 'td' : 'th'}>`,
                )
                .join('') +
              '</tr>',
          )
          .join('') +
        '</table></div>';
      continue;
    }
    const bullet = /^(?:- |\d+\. )(.*)/.exec(line);
    if (bullet) {
      const type = line.startsWith('-') ? 'ul' : 'ol';
      if (list !== type) {
        closeList();
        list = type;
        html += `<${list}>`;
      }
      html += `<li>${inline(bullet[1])}</li>`;
      continue;
    }
    closeList();
    html += `<p>${inline(line)}</p>`;
  }
  closeList();
  return html;
}
const table = (headers, rows) =>
  '<div class="table-scroll"><table><thead><tr>' +
  headers.map((h) => `<th>${esc(h)}</th>`).join('') +
  '</tr></thead><tbody>' +
  rows.map((cells) => '<tr>' + cells.map((c) => `<td>${c}</td>`).join('') + '</tr>').join('') +
  '</tbody></table></div>';
const valueHTML = (value) =>
  (/^#[a-f\d]{6}$/i.test(value)
    ? `<span class="swatch" style="background:${value}" aria-hidden="true"></span>`
    : '') + `<code>${esc(value)}</code>`;
const refs = table(
  ['Переменная', ...Object.values(themes).map((t) => t.name)],
  Object.keys(base).map((key) => [
    `<code>${esc(key)}</code>`,
    ...Object.values(themes).map((t) => valueHTML(t.tokens[key])),
  ]),
);
const semantic = table(
  ['Назначение', 'Фон', 'Текст', 'Граница'],
  membershipKinds.map((k) => [
    esc(k.name),
    valueHTML(k.background),
    valueHTML(k.foreground),
    valueHTML(k.line),
  ]),
);
const contextTable = table(
  ['Переменная', 'Значение', 'Область / источник'],
  contextual.map((v) => [
    `<code>${esc(v.name)}</code>`,
    valueHTML(v.value),
    `<code>${esc(v.source)}</code>`,
  ]),
);
const runtimeTable = table(
  ['Переменная', 'Выражение в компоненте', 'Источник'],
  runtimeVariables.map((v) => [
    `<code>${esc(v.name)}</code>`,
    `<code>${esc(v.expression)}</code>`,
    `<code>${esc(v.source)}</code>`,
  ]),
);
const rules = UI_RULES.map(
  (r) =>
    `<article><h3>${esc(r.title)}</h3><p>${esc(r.purpose)}</p><p><code>${r.components.map(esc).join(', ')}</code></p><ul>${r.rules.map((text) => `<li>${esc(text)}</li>`).join('')}</ul></article>`,
).join('');
const md = await read('docs/developer/README.md');
const html = `<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Астрон — спецификация разработчику</title><style>
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:#fdfdfc;color:#181c24;font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}header{background:white;border-bottom:1px solid #dce1e7;padding:16px max(20px,calc((100vw - 1160px)/2));display:flex;gap:16px;flex-wrap:wrap;align-items:center}a{color:#8a332c;text-underline-offset:3px}a:focus-visible{outline:2px solid #8a332c;outline-offset:3px}nav{display:flex;gap:16px;flex-wrap:wrap}main{max-width:1200px;margin:auto;padding:32px 20px 80px}h1{font-size:32px;line-height:1.2}h2{margin-top:40px;font-size:24px;border-top:1px solid #dce1e7;padding-top:24px}h3{font-size:20px;margin:0 0 12px}p,li{max-width:90ch}p{margin:16px 0}li{margin:8px 0}code{font:14px/1.6 ui-monospace,Consolas,monospace;overflow-wrap:anywhere}pre{overflow:auto;background:#f3f1ed;border-radius:10px;padding:20px}.table-scroll{overflow:auto;margin:24px 0;border:1px solid #dce1e7;border-radius:10px}table{border-collapse:collapse;width:100%;background:white}th,td{padding:12px 16px;text-align:left;vertical-align:top;border-bottom:1px solid #dce1e7;min-width:160px}th{font-size:14px;color:#606a5c;background:#fdfcf9}tr:last-child td{border:0}.swatch{display:inline-block;width:18px;height:18px;vertical-align:middle;border:1px solid #7c8794;border-radius:4px;margin-right:8px}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr));gap:20px}article{padding:24px;border:1px solid #dce1e7;border-radius:16px;background:white}.note{padding:16px;background:#f6ebe6;border-radius:10px;color:#3d4652}footer{color:#606a5c;border-top:1px solid #dce1e7;padding-top:24px}@media(max-width:600px){main{padding:24px 16px}h1{font-size:28px}article{padding:16px}}@media print{header{display:none}main{max-width:none;padding:0}h2{break-after:avoid}.table-scroll{overflow:visible}article,tr{break-inside:avoid}a{color:inherit}body{font-size:11pt}.cards{display:block}article{margin:12px 0}}
</style><header><strong>АСТРОН · РАЗРАБОТЧИКУ</strong><nav><a href="#spec">Спецификация</a><a href="#tokens">Все токены</a><a href="#rules">Компоненты</a><a href="#context">Локальные переменные</a><a href="design-tokens.json" download>JSON</a><a href="design-tokens.css" download>CSS</a><a href="implementation.md" download>Markdown</a><a href="../design-system.html">Стайлгайд</a></nav></header><main><section id="spec">${markdown(md)}</section><section id="tokens"><h2>Полный справочник базовых токенов</h2><p class="note">Значения извлечены из исходников. Цветовые поля уже рассчитаны для каждой темы; var() и color-mix() остаются валидными CSS-выражениями. В JSON также есть семантические шкалы расписания.</p>${refs}<h3>Цвета видов абонементов</h3>${semantic}</section><section id="rules"><h2>Реестр компонентов и правила</h2><div class="cards">${rules}</div></section><section id="context"><h2>Контекстные переменные из стилей</h2><p class="note">Это локальные декларации компонентов и адаптивные переопределения. Не копировать их все в :root: значения применяются только в исходной области CSS. Значок выбора --select-chevron вычисляется ThemeProvider, данные события и цвета карт передаются соответствующим компонентом.</p>${contextTable}<h3>Вычисляемые переменные</h3>${runtimeTable}</section><footer>Автоматический экспорт из исходников · pnpm docs:export · без платных зависимостей.</footer></main></html>\n`;
const outputs = {
  'public/developer/design-tokens.json': JSON.stringify(data, null, 2) + '\n',
  'public/developer/design-tokens.css': css,
  'public/developer/index.html': html,
  'public/developer/implementation.md': md,
};
for (const [file, content] of Object.entries(outputs)) {
  if (check) {
    if ((await read(file).catch(() => '')) !== content)
      throw new Error(`${file} is stale. Run pnpm docs:export.`);
  } else {
    await mkdir(dirname(resolve(root, file)), { recursive: true });
    await writeFile(resolve(root, file), content);
  }
}
console.log(
  `${check ? 'Verified' : 'Exported'} ${Object.keys(base).length} base tokens, ${THEME_OPTIONS.length} themes, ${contextual.length} contextual declarations and ${UI_RULES.length} component families. SHA256 ${createHash('sha256').update(JSON.stringify(data)).digest('hex').slice(0, 16)}`,
);
