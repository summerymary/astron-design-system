/** Browser contract checks. See docs/design/prototype-unification-2026-11-18.md. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.ASTRON_PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({
  headless: true,
  ...(process.env.ASTRON_CHROME_EXECUTABLE
    ? { executablePath: process.env.ASTRON_CHROME_EXECUTABLE }
    : {}),
});
const base = process.env.ASTRON_PREVIEW_URL || 'http://127.0.0.1:4173/';
const themes = ['', '?theme=111111', '?style=contrast', '?theme=202020&style=vivid'];
const evidence = { views: [], compactViews: [], scenarios: [], errors: [] };
const p = await browser.newPage();
p.setDefaultTimeout(8000);
p.on('pageerror', (e) => evidence.errors.push(e.message));
const url = (id, theme = '', mobile = false, path = 'admin-section') =>
  `${base}${theme}#/${path}?device=${mobile ? 'mobile' : 'desktop'}&state=default&role=club-director&section=statistics${id ? '&recordId=' + id : ''}`;
const choose = async (label, option) => {
  await p.locator('.app-content').getByRole('combobox', { name: label, exact: true }).click();
  await p.getByRole('option', { name: option, exact: true }).click();
};
const familyTab = async (name) =>
  p
    .getByRole('tablist', { name: 'Раздел аналитики', exact: true })
    .getByRole('tab', { name, exact: true })
    .click();
try {
  for (const width of [1440, 390])
    for (const theme of themes) {
      await p.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      await p.goto(url('', theme, width === 390, 'sections'));
      const search = p.locator('.sections-search-bar .search-field');
      await search.locator('input').focus();
      const searchGeometry = await search.evaluate((e) => {
        const s = getComputedStyle(e);
        return {
          height: e.getBoundingClientRect().height,
          offset: s.outlineOffset,
          width: s.outlineWidth,
        };
      });
      assert.equal(searchGeometry.height, 44);
      assert.equal(searchGeometry.offset, '-3px');
      assert.equal(searchGeometry.width, '2px');
      await p.goto(url('', theme, width === 390));
      await p.locator('[data-ui=report-catalogue]').waitFor();
      assert.equal(
        await p.locator('[data-ui=report-catalogue] [data-ui=navigation-card]').count(),
        18,
      );
      assert.ok(
        (
          await p
            .locator('[data-ui=report-catalogue] [role=tab]')
            .evaluateAll((es) => es.map((e) => e.getBoundingClientRect().height))
        ).every((h) => h === 48),
      );
      if (width === 1440)
        assert.ok(
          await p
            .locator('[data-ui=report-catalogue] [role=tablist]')
            .evaluate((e) => e.scrollWidth <= e.clientWidth + 1),
          'Desktop catalogue categories fit',
        );
      await p.goto(url('calls', theme, width === 390));
      await p.locator('#statistics-result').waitFor();
      const phones = await p
        .locator('#statistics-result [data-ui=phone-action]')
        .evaluateAll((es) =>
          es
            .filter((e) => e.getBoundingClientRect().width > 0)
            .map((e) => ({
              h: e.getBoundingClientRect().height,
              wrap: getComputedStyle(e.querySelector('span')).whiteSpace,
            })),
        );
      assert.ok(phones.every((v) => v.wrap === 'nowrap' && v.h <= (width === 390 ? 44 : 36)));
      assert.ok(
        (await p.locator('#statistics-result').innerText()).includes('+7 900'),
        'Club phone survives shared journal rendering',
      );
      await p.locator('.statistics-filter-disclosure summary').click();
      const labels = await p
        .locator('.statistics-filters-extra .ws-checkbox')
        .evaluateAll((es) => es.map((e) => ({ w: e.clientWidth, scroll: e.scrollWidth })));
      assert.ok(
        labels.every((e) => e.scroll <= e.w + 1),
        'Long filter labels fit their own container',
      );
      await p.goto(url('selling_stat', theme, width === 390));
      await p.locator('#statistics-result').waitFor();
      const action = p.getByRole('button', { name: /^Действия:/ }).first();
      await action.click();
      const menu = p.locator('.record-actions-menu:popover-open');
      await menu.waitFor();
      const rect = await menu.boundingBox();
      assert.ok(
        rect.x >= 0 &&
          rect.x + rect.width <= width &&
          rect.y >= 0 &&
          rect.y + rect.height <= (width === 390 ? 844 : 1000),
      );
      await p.keyboard.press('Escape');
      assert.equal(await p.locator('.record-actions-menu:popover-open').count(), 0);
      await action.click();
      await p.getByRole('button', { name: 'Кто купил', exact: true }).click();
      await p.getByRole('button', { name: '← К сводке отчёта', exact: true }).waitFor();
      const downloaded = p.waitForEvent('download');
      await p.getByRole('button', { name: 'Скачать CSV', exact: true }).click();
      const file = await downloaded;
      const stream = await file.createReadStream();
      const chunks = [];
      for await (const c of stream) chunks.push(c);
      const csv = Buffer.concat(chunks).toString('utf8');
      assert.ok(csv.includes('Покупатели'));
      assert.ok(!csv.includes('Список операций'));
      assert.ok(!csv.includes('Действия'));
      await p.goto(url('finbyyear', theme, width === 390));
      await p.locator('.report-chart-scroll svg').waitFor();
      const timeline = await p
        .locator('.report-chart-scroll')
        .first()
        .evaluate((e) => ({
          viewport: e.clientWidth,
          content: e.scrollWidth,
          svg: e.querySelector('svg').getBoundingClientRect().width,
        }));
      if (width === 1440)
        assert.ok(
          timeline.content <= timeline.viewport + 1,
          'Twelve revenue months fit a desktop container',
        );
      assert.ok(timeline.svg >= timeline.viewport - 1, 'Timeline uses available width');
      const timelineSize = await p
        .locator('.report-columns')
        .first()
        .evaluate((e) => ({
          height: e.getBoundingClientRect().height,
          font: parseFloat(getComputedStyle(e.querySelector('text')).fontSize),
        }));
      assert.ok(
        timelineSize.height >= 320 && timelineSize.font >= 16,
        'Readable timeline canvas and labels',
      );
      await p.goto(url('visit_by_period', theme, width === 390));
      await p.locator('[data-chart-category]').first().waitFor();
      const dayLabels = await p.locator('[data-chart-category]').allTextContents();
      assert.ok(dayLabels.length > 1 && dayLabels.every((day) => /^\d{2}$/.test(day)));
      assert.equal(new Set(dayLabels).size, dayLabels.length, 'Daily axis labels remain distinct');
      await p.goto(url('unique_visits', theme, width === 390));
      const donutSize = await p
        .locator('.report-donut svg')
        .first()
        .evaluate((e) => e.getBoundingClientRect().width);
      assert.ok(
        donutSize >= (width === 390 ? 240 : 320),
        'Donut does not stay a tiny desktop thumbnail',
      );
      await p.goto(url('clients_gender_age', theme, width === 390));
      const pyramid = await p
        .locator('.report-pyramid')
        .first()
        .evaluate((e) => ({
          width: e.clientWidth,
          content: e.scrollWidth,
          tracks: [...e.querySelectorAll('.report-pyramid-track')].map(
            (t) => t.getBoundingClientRect().width,
          ),
          heights: [...e.querySelectorAll('.report-pyramid-side i')].map(
            (t) => t.getBoundingClientRect().height,
          ),
        }));
      assert.ok(
        pyramid.content <= pyramid.width + 1,
        'Both pyramid halves fit without horizontal scrolling',
      );
      assert.ok(pyramid.tracks.every((w) => w >= 70) && pyramid.heights.every((h) => h >= 24));
      await p.goto(url('clients_rating', theme, width === 390));
      await p.locator('[data-ui=report-bars] [role=meter]').first().waitFor();
      const barSizes = await p.locator('[data-ui=report-bars] [role=meter]').evaluateAll((es) =>
        es.map((e) => ({
          height: e.getBoundingClientRect().height,
          fillHeight: e.firstElementChild.getBoundingClientRect().height,
          width: e.getBoundingClientRect().width,
          fillWidth: e.firstElementChild.getBoundingClientRect().width,
          value: Number(e.getAttribute('aria-valuenow')),
          maximum: Number(e.getAttribute('aria-valuemax')),
        })),
      );
      assert.ok(
        barSizes.length > 0 &&
          barSizes.every((bar) => bar.height >= 24 && bar.fillHeight === bar.height),
        'Category bars have a consistent visible thickness',
      );
      assert.ok(
        barSizes.every(
          (bar) => Math.abs(bar.fillWidth - (bar.width * bar.value) / bar.maximum) <= 1,
        ),
        'Bar thickness does not change the numeric proportion',
      );
      await p.goto(url('', theme, width === 390, 'members'));
      await p.getByRole('tab', { name: 'Абонементы', exact: true }).click();
      const status = p.getByRole('radiogroup', { name: 'Статус абонемента', exact: true });
      await status.getByRole('radio', { name: /^Активные/ }).click();
      await p.keyboard.press('ArrowRight');
      assert.equal(
        await status.getByRole('radio', { name: /^Истекают/ }).getAttribute('aria-checked'),
        'true',
      );
      const filterHeights = await status
        .getByRole('radio')
        .evaluateAll((es) => es.map((e) => e.getBoundingClientRect().height));
      assert.ok(filterHeights.every((h) => h >= (width === 390 ? 44 : 36)));
      evidence.views.push({
        width,
        theme,
        searchGeometry,
        phones,
        timeline,
        timelineSize,
        dayLabels,
        donutSize,
        pyramid,
        barSizes,
        filterHeights,
      });
    }
  await p.setViewportSize({ width: 320, height: 844 });
  for (const theme of themes) {
    await p.goto(url('clients_sell_gender_age', theme, true));
    for (const measure of ['Количество покупок', 'Сумма']) {
      await choose('Показатель', measure);
      const size = await p.locator('.report-pyramid').evaluate((e) => ({
        width: e.clientWidth,
        content: e.scrollWidth,
      }));
      assert.ok(size.content <= size.width + 1, 'Pyramid headings fit a 320 px phone');
      evidence.compactViews.push({ width: 320, theme, measure, size });
    }
  }
  await p.setViewportSize({ width: 1440, height: 1000 });
  await p.goto(url('unique_visits'));
  await choose('Клуб', 'Парк');
  await p.getByLabel('С даты', { exact: true }).fill('2026-10-01');
  await familyTab('Параметры');
  assert.equal(await p.getByLabel('С даты', { exact: true }).inputValue(), '2026-10-01');
  assert.match(
    await p
      .locator('.app-content')
      .getByRole('combobox', { name: 'Клуб', exact: true })
      .innerText(),
    /Парк/,
  );
  await p.getByLabel('С даты', { exact: true }).fill('2026-10-15');
  await familyTab('Обзор');
  assert.equal(await p.getByLabel('С даты', { exact: true }).inputValue(), '2026-10-15');
  await familyTab('Аудитория');
  await p.locator('.statistics-filter-disclosure summary').click();
  assert.equal(await p.getByLabel('Парк', { exact: true }).isChecked(), true);
  evidence.scenarios.push(
    'compatible period and club follow family navigation, including previously visited views',
  );
  await p.goto(url('clients_new'));
  await choose('Считать новыми по', 'Первому известному визиту');
  await familyTab('Источники');
  assert.match(
    await p
      .locator('.app-content')
      .getByRole('combobox', { name: 'Считать новыми по', exact: true })
      .innerText(),
    /Первому известному визиту/,
  );
  await familyTab('Клиенты');
  assert.equal(
    await p.getByRole('tablist', { name: 'Раздел аналитики' }).getByRole('tab').count(),
    2,
  );
  evidence.scenarios.push('new client list, sources and legacy alias have one visible criterion');
  await p.goto(url('trener_financial_result'));
  const defaultColumns = await p.locator('#statistics-result .ws-table thead th').count();
  await choose('Показатель по месяцам', 'Все показатели');
  const allColumns = await p.locator('#statistics-result .ws-table thead th').count();
  assert.ok(allColumns > defaultColumns * 2);
  await choose('Показатель по месяцам', 'Продажи ПТ');
  await choose('Тренер', 'Максим Ветров');
  await p.getByRole('heading', { name: 'Динамика выбранного тренера', exact: true }).waitFor();
  await p.locator('input[type=month]').fill('2025-12');
  await p.getByRole('button', { name: 'Следующий месяц', exact: true }).click();
  assert.equal(await p.locator('input[type=month]').inputValue(), '2026-01');
  evidence.scenarios.push('trainer matrix measure, full view, trend and year boundary');
  await p.goto(url('gt_finance'));
  assert.match(
    await p
      .locator('.app-content')
      .getByRole('combobox', { name: 'Представление', exact: true })
      .innerText(),
    /По тренерам/,
  );
  await choose('Представление', 'По программам');
  await choose('Представление', 'Занятия');
  evidence.scenarios.push('group finance trainer/program/lesson views');
  await p.goto(
    `${base}#/admin-section?device=desktop&state=default&role=club-director&section=schedule`,
  );
  await p.getByRole('button', { name: 'Планирование тренеров', exact: true }).click();
  await p.getByRole('button', { name: 'Занятость тренеров', exact: true }).click();
  await p.getByRole('button', { name: 'Вернуться в календарь', exact: true }).waitFor();
  await familyTab('Свободное время');
  await p.getByRole('button', { name: 'Вернуться в календарь', exact: true }).click();
  await p.locator('.calendar-toolbar').waitFor();
  evidence.scenarios.push('planning modes live inside schedule and return to calendar');
  await p.goto(`${base}design-system.html`);
  await p.getByRole('button', { name: /Единые правила/ }).click();
  const stable = p
    .locator('[data-ui=report-chart]')
    .filter({ has: p.getByRole('heading', { name: 'Устойчивые цвета результатов', exact: true }) });
  const lost = stable
    .locator('li')
    .filter({ hasText: /Не продлили/ })
    .locator('.report-donut-key');
  const tone = await lost.evaluate((e) => getComputedStyle(e).backgroundColor);
  await p.getByRole('button', { name: 'Переключить нулевую категорию', exact: true }).click();
  assert.equal(await lost.evaluate((e) => getComputedStyle(e).backgroundColor), tone);
  const input = p.getByLabel('Пример обязательного поля', { exact: false });
  await input.fill('а');
  assert.equal(await input.getAttribute('aria-invalid'), 'true');
  const described = await input.getAttribute('aria-describedby');
  assert.ok(described);
  assert.equal(await p.locator(`[id="${described}"]`).innerText(), 'Введите хотя бы три символа');
  await input.fill('Анна');
  assert.equal(await input.getAttribute('aria-invalid'), null);
  evidence.scenarios.push('live stable semantic colors and field error association');
  assert.deepEqual(evidence.errors, []);
  if (process.env.ASTRON_UI_EVIDENCE)
    await writeFile(process.env.ASTRON_UI_EVIDENCE, JSON.stringify(evidence, null, 2));
  console.log(
    `UI browser: ${evidence.views.length} theme/device contracts, ${evidence.compactViews.length} narrow chart views and ${evidence.scenarios.length} interaction scenarios passed.`,
  );
} finally {
  await browser.close();
}
