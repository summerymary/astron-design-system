import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import ts from 'typescript';

const read = (path) => readFile(new URL('../' + path, import.meta.url), 'utf8');
const load = async (path) =>
  import(
    'data:text/javascript;base64,' +
      Buffer.from(
        ts.transpileModule(await read(path), {
          compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
        }).outputText,
      ).toString('base64')
  );
const { statusTone, feedbackTone } = await load('src/lib/ui-semantics.ts');
const { lockScroll } = await load('src/lib/overlay.ts');
for (const order of [
  [0, 1],
  [1, 0],
]) {
  const body = { style: { overflow: 'auto' } };
  const releases = [lockScroll(body), lockScroll(body)];
  releases[order[0]]();
  assert.equal(body.style.overflow, 'hidden', 'An open nested overlay lost its scroll lock');
  releases[order[0]]();
  assert.equal(body.style.overflow, 'hidden', 'Repeated cleanup released another overlay lock');
  releases[order[1]]();
  assert.equal(body.style.overflow, 'auto', 'Nested overlay cleanup left the page locked');
}
const blankBody = { style: { overflow: '' } };
lockScroll(blankBody)();
assert.equal(blankBody.style.overflow, '', 'The original inline style was not restored');
assert.equal(feedbackTone('Не удалось сохранить запись'), 'danger');
assert.equal(feedbackTone('Не сохранено'), 'danger');
assert.equal(feedbackTone('Сохранено'), 'success');
assert.equal(feedbackTone('Посещение зарегистрировано по карте'), 'success');
assert.equal(feedbackTone('Открыта демонстрационная форма'), 'info');
for (const [input, expected] of Object.entries({
  Действует: 'success',
  АКТИВЕН: 'success',
  Оплачено: 'success',
  Подтверждён: 'success',
  'Не активен': 'neutral',
  Неактивна: 'neutral',
  Архив: 'neutral',
  Завершён: 'neutral',
  Истёк: 'neutral',
  'Не оплачено': 'warning',
  'Не погашено': 'warning',
  'На согласовании': 'warning',
  Проведён: 'success',
  'Не активирован': 'warning',
  'Мест нет': 'warning',
  Черновик: 'warning',
  Отменено: 'danger',
  Ошибка: 'danger',
  Заморожен: 'paused',
  'В работе': 'info',
  Прочитано: 'info',
  '  ожидает   ответа  ': 'warning',
  'совершенно новое состояние': 'neutral',
  'Не подтверждено': 'neutral',
}))
  assert.equal(statusTone(input), expected, `Incorrect status meaning: ${input}`);

const { UI_RULES, UI_METRICS, UI_INFRASTRUCTURE } = await load('src/design-system/registry.ts');
const documented = new Set(UI_RULES.flatMap((rule) => rule.components));
assert.equal(new Set(UI_RULES.map((rule) => rule.id)).size, UI_RULES.length, 'Duplicate rule IDs');
for (const rule of UI_RULES)
  assert.ok(rule.title && rule.purpose && rule.rules.length, `Incomplete rule: ${rule.id}`);
const components = (await readdir(new URL('../src/components/', import.meta.url)))
  .filter((file) => file.endsWith('.tsx'))
  .map((file) => 'src/components/' + file);
const pages = (await readdir(new URL('../src/pages/', import.meta.url)))
  .filter((file) => file.endsWith('.tsx'))
  .map((file) => 'src/pages/' + file);
let count = 0;
for (const file of ['src/App.tsx', ...components, ...pages]) {
  const source = await read(file);
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function walk(node) {
    const location = `${file}:${tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1}`;
    if (
      file.startsWith('src/components/') &&
      ts.isFunctionDeclaration(node) &&
      node.name &&
      /^[A-Z]/.test(node.name.text) &&
      node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
    ) {
      const name = node.name.text;
      assert.ok(
        documented.has(name) || UI_INFRASTRUCTURE.includes(name),
        `${location}: ${name} needs a design rule and example in the registry`,
      );
      count++;
    }
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(tree),
        attributes = node.attributes.properties;
      assert.ok(
        tag !== 'select' || file === 'src/components/Select.tsx',
        `${location}: use the shared Select`,
      );
      const cls =
        attributes
          .find((attribute) => attribute.name?.getText(tree) === 'className')
          ?.initializer?.getText(tree) || '';
      if (tag === 'button' && cls.includes('icon-button')) {
        assert.ok(
          attributes.some((attribute) =>
            ['aria-label', 'aria-labelledby', 'title'].includes(attribute.name?.getText(tree)),
          ),
          `${location}: icon-only control needs an accessible name`,
        );
      }
      if (['Button', 'IconButton', 'Select', 'input', 'textarea'].includes(tag)) {
        assert.ok(
          !attributes.some((attribute) => attribute.name?.getText(tree) === 'style'),
          `${location}: shared controls must not have inline appearance overrides`,
        );
      }
    }
    ts.forEachChild(node, walk);
  }
  walk(tree);
}
const tokens = await read('src/styles/tokens.css');
assert.match(
  await read('src/components/WorkspaceUI.tsx'),
  /import '\.\.\/styles\/workspace\.css'/,
  'Shared workspace components must carry their base styles into both entry points',
);
for (const [token, value] of Object.entries({
  '--control-height': UI_METRICS.controlHeight,
  '--control-height-compact': UI_METRICS.compactHeight,
  '--radius-control': UI_METRICS.controlRadius,
  '--radius-card': UI_METRICS.panelRadius,
  '--text-body': UI_METRICS.bodyText,
  '--text-caption': UI_METRICS.captionText,
})) {
  assert.match(
    tokens,
    new RegExp(`${token}:\\s*${value}px;`),
    `${token}: documentation and tokens diverged`,
  );
}
for (const file of ['src/main.tsx', 'src/design-system.tsx'])
  assert.match(
    await read(file),
    /import '\.\/styles\/components\.css'/,
    `${file}: shared rules must load in prototype and guide`,
  );
for (const dir of ['src/styles', 'src/components']) {
  for (const file of (await readdir(new URL('../' + dir + '/', import.meta.url))).filter(
    (name) => name.endsWith('.css') && name !== 'components.css',
  )) {
    const css = (await read(dir + '/' + file)).replace(
      /\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g,
      '',
    );
    let depth = 0,
      heading = '';
    for (const char of css) {
      if (depth === 0) {
        if (char === '{') {
          assert.match(
            heading.trim(),
            /^@layer (legacy|pages)$/,
            `${dir}/${file}: unlayered page CSS can override shared components`,
          );
          depth = 1;
          heading = '';
        } else heading += char;
      } else if (char === '{') depth++;
      else if (char === '}') depth--;
    }
    assert.equal(depth, 0, `${dir}/${file}: unbalanced layer`);
    assert.equal(heading.trim(), '', `${dir}/${file}: CSS outside a permitted layer`);
  }
}
console.log(
  `UI contract checks passed: ${count} registered components, ${UI_RULES.length} rule families, complete status meanings, common Select, named icon controls and shared metrics.`,
);
