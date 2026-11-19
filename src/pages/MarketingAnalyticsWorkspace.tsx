import { useId, useState } from 'react';
import { Download } from 'lucide-react';
import { Button, Modal, StatusBadge } from '../components/ui';
import { Back, Empty, Notice, SearchBox, Stats, Tabs } from '../components/WorkspaceUI';
import { Field } from '../components/Field';
import { Select } from '../components/Select';
import { ReportFilterBar } from '../components/ReportFilterBar';
import { ReportChart } from '../components/ReportChart';
import { ReportTreeTable } from '../components/ReportTreeTable';
import type { ReportTreeColumn } from '../components/ReportTreeTable';
import { flattenReportTree, sortReportTree } from '../lib/report-tree';
import type { ReportTreeNode, ReportTreeSort } from '../lib/report-tree';
import type { StatisticsChart } from '../lib/statistics-charts';
import { TODAY } from '../data/workspace';
import {
  createWebSample,
  shiftWebDay,
  webSources,
  webMaterials,
  webOffers,
  webScope,
  webSourceRows,
  webSourceTrend,
  webDays,
  webVisitMetrics,
  webMaterialRows,
  webMaterialMetrics,
  webOfferTree,
  webOfferMetrics,
  webCsv,
} from '../lib/web-analytics';
import type { WebFilters, WebView } from '../lib/web-analytics';
import '../styles/statistics.css';
import '../styles/marketing-analytics.css';

const sample = createWebSample(TODAY);
const number = (n: number | null) =>
  n === null ? '—' : n.toLocaleString('ru-RU', { maximumFractionDigits: 1 });
const percent = (n: number | null) => (n === null ? '—' : number(n) + '%');
const duration = (n: number | null) =>
  n === null
    ? '—'
    : `${Math.floor(Math.round(n) / 60)}:${String(Math.round(n) % 60).padStart(2, '0')}`;
const shortDate = (day: string) => day.split('-').reverse().join('.');
const viewNames = {
  sources: 'Источники переходов',
  materials: 'Материалы',
  offers: 'Категории и предложения',
};
const columnsByView: Record<WebView, ReportTreeColumn[]> = {
  sources: [
    { key: 'visits', label: 'Визиты' },
    { key: 'visitors', label: 'Посетители' },
    { key: 'views', label: 'Просмотры' },
    { key: 'buyers', label: 'Визиты с покупкой' },
    { key: 'conversion', label: 'Конверсия в покупку', format: percent },
  ],
  materials: [
    { key: 'views', label: 'Просмотры' },
    { key: 'visitors', label: 'Посетители' },
    { key: 'seconds', label: 'Среднее время', format: duration },
    { key: 'read', label: 'Дочтения', format: percent },
    { key: 'scroll', label: 'Доскроллы', format: percent },
    { key: 'next', label: 'Рециркуляция', format: percent },
  ],
  offers: [
    { key: 'visits', label: 'Визиты' },
    { key: 'views', label: 'Просмотры предложений' },
    { key: 'visitors', label: 'Посетители предложений' },
    { key: 'cart', label: 'Добавления в корзину' },
    { key: 'purchases', label: 'Покупки на сайте' },
  ],
};

export function MarketingAnalyticsWorkspace({
  view,
  onView,
  onBack,
}: {
  view: WebView;
  onView: (view: WebView) => void;
  onBack: () => void;
}) {
  const [filters, setFilters] = useState<WebFilters>({
    from: shiftWebDay(TODAY, -6),
    to: TODAY,
    source: 'all',
    device: 'all',
    robots: false,
  });
  const [query, setQuery] = useState('');
  const [metric, setMetric] = useState<'visits' | 'visitors'>('visits');
  const [showChart, setShowChart] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [sorts, setSorts] = useState<Record<WebView, ReportTreeSort>>({
    sources: { key: 'visits', asc: false },
    materials: { key: 'views', asc: false },
    offers: { key: 'views', asc: false },
  });
  const graphId = useId(),
    panelId = useId();
  const scope = webScope(sample, filters);
  const visits = scope.visits;
  const sourceRows = webSourceRows(visits, query).filter(
    (row) => filters.source === 'all' || row.id === filters.source,
  );
  const sourceVisits = visits.filter((v) => sourceRows.some((s) => s.id === v.source));
  const sourcesTotal = webVisitMetrics(sourceVisits);
  const materials = webMaterialRows(visits, query);
  const materialIds = materials.map((m) => m.id);
  const materialTotal = webMaterialMetrics(visits, materialIds);
  const offers = webOfferTree(visits, query);
  const columns = columnsByView[view];
  const materialValues = (m: typeof materialTotal) => ({
    views: m.views,
    visitors: m.visitors,
    seconds: m.seconds,
    read: m.read.value,
    scroll: m.scroll.value,
    next: m.next.value,
  });
  const nodes: ReportTreeNode[] =
    view === 'sources'
      ? sourceRows.map((s) => ({
          id: s.id,
          name: s.name,
          values: {
            visits: s.visits,
            visitors: s.visitors,
            views: s.views,
            buyers: s.buyers,
            conversion: s.conversion,
          },
        }))
      : view === 'materials'
        ? materials.map((m) => ({
            id: m.id,
            name: m.name,
            note: m.path,
            values: materialValues(m),
          }))
        : offers.nodes;
  const total: ReportTreeNode = {
    id: 'total',
    name: 'Всего по фильтру',
    values:
      view === 'sources'
        ? sourcesTotal
        : view === 'materials'
          ? materialValues(materialTotal)
          : offers.total,
  };
  const days = scope.covered ? webDays(scope.from, scope.to) : [];
  const chart: StatisticsChart =
    view === 'sources'
      ? {
          id: 'web-sources',
          title: metric === 'visits' ? 'Визиты по источникам' : 'Посетители по источникам',
          unit: metric === 'visits' ? 'визитов за день' : 'посетителей за день',
          kind: 'lines',
          series: sourceRows.map((s) => ({ key: s.id, label: s.name, tone: s.tone })),
          rows: webSourceTrend(
            visits,
            days,
            sourceRows.map((s) => s.id),
            metric,
          ),
          note: 'Посетители уникальны внутри дня и источника. Итог периода считается отдельно, без сложения дневных значений.',
        }
      : {
          id: 'web-ranking',
          title: view === 'materials' ? 'Просмотры материалов' : 'Интерес к категориям',
          unit: 'просмотров',
          kind: 'bars',
          series: [{ key: 'views', label: 'Просмотры' }],
          rows: [...nodes]
            .sort((a, b) => (b.values.views || 0) - (a.values.views || 0))
            .map((n) => ({ id: n.id, name: n.name, values: [n.values.views] })),
        };
  const updateFilters = (patch: Partial<WebFilters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setSelected(null);
  };
  const csv = () => {
    const rows = flattenReportTree(sortReportTree(nodes, sorts[view])).map(({ node, path }) => [
      path.length - 1,
      path.join(' / '),
      ...columns.map((c) => (c.format ? c.format(node.values[c.key] ?? null) : node.values[c.key])),
    ]);
    rows.push([
      '',
      total.name,
      ...columns.map((c) =>
        c.format ? c.format(total.values[c.key] ?? null) : total.values[c.key],
      ),
    ]);
    const content = webCsv(['Уровень', 'Название', ...columns.map((c) => c.label)], rows);
    const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `astron-web-${view}-${filters.from}-${filters.to}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const stats =
    view === 'sources'
      ? [
          { label: 'Визиты', value: number(sourcesTotal.visits) },
          { label: 'Посетители', value: number(sourcesTotal.visitors) },
          { label: 'Визиты с покупкой', value: number(sourcesTotal.buyers) },
          { label: 'Конверсия в покупку', value: percent(sourcesTotal.conversion) },
        ]
      : view === 'materials'
        ? [
            { label: 'Просмотры материалов', value: number(materialTotal.views) },
            { label: 'Читатели', value: number(materialTotal.visitors) },
            { label: 'Среднее время', value: duration(materialTotal.seconds) },
            { label: 'Дочтения', value: percent(materialTotal.read.value) },
          ]
        : [
            { label: 'Просмотры предложений', value: number(offers.total.views) },
            { label: 'Посетители предложений', value: number(offers.total.visitors) },
            { label: 'Добавления в корзину', value: number(offers.total.cart) },
            { label: 'Покупки на сайте', value: number(offers.total.purchases) },
          ];
  const selectedMaterial =
    view === 'materials' ? webMaterials.find((m) => m.id === selected) : undefined;
  const selectedOffer = view === 'offers' ? webOffers.find((o) => o.id === selected) : undefined;
  const detailTitle = selectedMaterial?.name || selectedOffer?.name;
  const detailMetric = selectedMaterial
    ? webMaterialMetrics(visits, [selectedMaterial.id])
    : selectedOffer
      ? webOfferMetrics(visits, [selectedOffer.id])
      : null;
  const detailChart: StatisticsChart = {
    id: 'web-detail',
    kind: 'columns',
    title: selectedMaterial ? 'Просмотры материала по дням' : 'Просмотры предложения по дням',
    unit: 'просмотров',
    series: [{ key: 'views', label: 'Просмотры' }],
    rows: days.map((day) => {
      const daily = visits.filter((v) => v.day === day);
      return {
        id: day,
        name: shortDate(day),
        values: [
          selectedMaterial
            ? webMaterialMetrics(daily, [selectedMaterial.id]).views
            : selectedOffer
              ? webOfferMetrics(daily, [selectedOffer.id]).views
              : 0,
        ],
      };
    }),
  };
  const materialDetails = selectedMaterial
    ? webMaterialMetrics(visits, [selectedMaterial.id])
    : null;
  return (
    <div className="ws-stack marketing-analytics">
      <section className="panel ws-panel">
        <div className="ws-panel-heading">
          <div>
            <h2>Аналитика сайта</h2>
          </div>
          <Back onClick={onBack}>В маркетинг</Back>
        </div>
        <Tabs
          items={(Object.keys(viewNames) as WebView[]).map((id) => ({ id, label: viewNames[id] }))}
          value={view}
          label="Отчёты аналитики сайта"
          panelId={panelId}
          onChange={(id) => {
            setQuery('');
            setSelected(null);
            onView(id as WebView);
          }}
        />
        <div className="ws-panel-body ws-stack">
          <div className="ws-actions">
            <StatusBadge tone="info">Демо-данные</StatusBadge>
            <span className="ws-muted">
              {shortDate(filters.from)}–{shortDate(filters.to)} ·{' '}
              {webSources.find((s) => s.id === filters.source)?.name || 'Все источники'}
              {filters.device !== 'all'
                ? filters.device === 'mobile'
                  ? ' · Телефоны'
                  : ' · Компьютеры'
                : ''}
              {filters.robots ? ' · С роботами' : ''} · Метрика не подключена
            </span>
          </div>
          <div className="analytics-period-controls">
            <div className="ws-actions" aria-label="Быстрый выбор периода">
              {[
                { days: 1, label: 'День' },
                { days: 7, label: '7 дней' },
                { days: 30, label: '30 дней' },
              ].map((p) => (
                <Button
                  key={p.days}
                  variant="secondary"
                  aria-pressed={
                    filters.to === TODAY && filters.from === shiftWebDay(TODAY, 1 - p.days)
                  }
                  onClick={() => updateFilters({ from: shiftWebDay(TODAY, 1 - p.days), to: TODAY })}
                >
                  {p.label}
                </Button>
              ))}
            </div>
            <ReportFilterBar
              label="Фильтры"
              activeCount={
                Number(filters.source !== 'all') +
                Number(filters.device !== 'all') +
                Number(filters.robots) +
                Number(filters.to !== TODAY || filters.from !== shiftWebDay(TODAY, -6))
              }
            >
              <Field label="С даты">
                <input
                  type="date"
                  value={filters.from}
                  onChange={(e) => updateFilters({ from: e.target.value })}
                />
              </Field>
              <Field label="По дату">
                <input
                  type="date"
                  value={filters.to}
                  onChange={(e) => updateFilters({ to: e.target.value })}
                />
              </Field>
              <Field label="Источник перехода">
                <Select
                  value={filters.source}
                  onChange={(e) => updateFilters({ source: e.target.value })}
                >
                  <option value="all">Все источники</option>
                  {webSources.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Устройство">
                <Select
                  value={filters.device}
                  onChange={(e) => updateFilters({ device: e.target.value })}
                >
                  <option value="all">Все устройства</option>
                  <option value="mobile">Телефон</option>
                  <option value="desktop">Компьютер</option>
                </Select>
              </Field>
              <label className="ws-checkbox">
                <input
                  type="checkbox"
                  checked={filters.robots}
                  onChange={(e) => updateFilters({ robots: e.target.checked })}
                />
                Учитывать роботов
              </label>
            </ReportFilterBar>
          </div>
        </div>
      </section>
      <div role="tabpanel" id={panelId} aria-label={viewNames[view]} className="ws-stack">
        {scope.error ? (
          <Notice tone="warning">{scope.error}</Notice>
        ) : !scope.covered ? (
          <Empty
            title="За этот период нет данных"
            text={`Демонстрационный набор содержит данные с ${shortDate(sample.from)} по ${shortDate(sample.to)}. Это не нулевой результат сайта.`}
          />
        ) : (
          <>
            {scope.partial && (
              <Notice tone="warning">
                Период покрыт частично. Показаны только данные {shortDate(scope.from)}–
                {shortDate(scope.to)}.
              </Notice>
            )}
            <Stats items={stats} />
            <div className="ws-actions analytics-chart-controls">
              <SearchBox
                label={`Поиск: ${viewNames[view]}`}
                placeholder={
                  view === 'sources'
                    ? 'Название источника'
                    : view === 'materials'
                      ? 'Название или путь материала'
                      : 'Категория, группа или предложение'
                }
                value={query}
                onChange={(value) => {
                  setQuery(value);
                  setSelected(null);
                }}
              />
              {view === 'sources' && (
                <Field label="Показатель графика">
                  <Select
                    value={metric}
                    onChange={(e) => setMetric(e.target.value as 'visits' | 'visitors')}
                  >
                    <option value="visits">Визиты</option>
                    <option value="visitors">Посетители</option>
                  </Select>
                </Field>
              )}
              <Button
                variant="secondary"
                aria-expanded={showChart}
                aria-controls={graphId}
                onClick={() => setShowChart((v) => !v)}
              >
                {showChart ? 'Скрыть график' : 'Показать график'}
              </Button>
              <Button
                variant="secondary"
                disabled={!nodes.length}
                title="Все найденные строки, включая вложенные, и итог по фильтру"
                onClick={csv}
              >
                <Download size={18} />
                CSV
              </Button>
            </div>
            <div id={graphId} hidden={!showChart}>
              {showChart &&
                (nodes.length && visits.length ? (
                  <ReportChart chart={chart} />
                ) : (
                  <Empty
                    title="Нет данных по выбранным условиям"
                    text="Измените поиск, источник или устройство."
                  />
                ))}
            </div>
            <section className="panel ws-panel">
              <div className="ws-panel-heading">
                <div>
                  <h3>{viewNames[view]}</h3>
                  <p>
                    {view === 'offers'
                      ? 'Категория → группа → предложение. Раскройте строку, чтобы увидеть состав.'
                      : view === 'materials'
                        ? 'Нажмите название: динамика, источники просмотров и полнота измерений.'
                        : 'Нажмите источник, чтобы оставить его в фильтре.'}
                  </p>
                </div>
              </div>
              <ReportTreeTable
                key={`${view}:${query}`}
                nodes={nodes}
                columns={columns}
                sort={sorts[view]}
                onSort={(sort) => setSorts((s) => ({ ...s, [view]: sort }))}
                total={total}
                label={viewNames[view]}
                nameLabel={
                  view === 'sources'
                    ? 'Источник'
                    : view === 'materials'
                      ? 'Материал'
                      : 'Категория / предложение'
                }
                initiallyExpanded={!!query.trim()}
                openLabel={view === 'sources' ? 'Выбрать источник' : 'Подробнее'}
                onOpen={(node) =>
                  view === 'sources' ? updateFilters({ source: node.id }) : setSelected(node.id)
                }
              />
            </section>
            <details className="panel ws-panel-body analytics-definitions">
              <summary>Как считаются показатели</summary>
              <p>
                Визит — отдельный сеанс сайта, посетитель — уникальный демонстрационный
                идентификатор внутри выборки. Визит с покупкой содержит хотя бы одно событие
                покупки; конверсия — доля таких визитов. Покупки на сайте — события веб-аналитики,
                не кассовые операции клуба.
              </p>
              <p>
                Дочтение — событие завершения чтения, доскролл — достижение конца страницы,
                рециркуляция — переход к другому материалу. Их доли считаются только по просмотрам с
                известным результатом измерения; среднее время — по просмотрам с известной
                длительностью. Неизвестные значения обозначены «—», полнота — в деталях материала.
              </p>
              <p>
                В категориях просмотры, добавления и покупки — числа событий; визиты и посетители в
                каждом узле считаются заново по объединению, поэтому итоги не обязаны равняться
                сумме строк. Названия и числа вымышлены; данных из счётчика или кассы здесь нет.
              </p>
            </details>
          </>
        )}
      </div>
      {detailTitle && detailMetric && (
        <Modal
          size="wide"
          title={detailTitle}
          subtitle={`${shortDate(scope.from)}–${shortDate(scope.to)}`}
          onClose={() => setSelected(null)}
        >
          <div className="ws-stack">
            <Stats
              items={[
                { label: 'Просмотры', value: number(detailMetric.views) },
                { label: 'Посетители', value: number(detailMetric.visitors) },
                ...(materialDetails
                  ? [
                      { label: 'Среднее время', value: duration(materialDetails.seconds) },
                      { label: 'Дочтения', value: percent(materialDetails.read.value) },
                    ]
                  : []),
              ]}
            />
            {materialDetails && (
              <p className="ws-muted">
                Из {materialDetails.views} просмотров: время известно для {materialDetails.timed},
                дочтение — для {materialDetails.read.known}, доскролл — для{' '}
                {materialDetails.scroll.known}, переход к другому материалу — для{' '}
                {materialDetails.next.known}. Неизмеренные просмотры не считаются отказами.
              </p>
            )}
            <ReportChart chart={detailChart} />
            {selectedMaterial && (
              <ReportChart
                chart={{
                  id: 'web-material-sources',
                  kind: 'bars',
                  title: 'Источники просмотров материала',
                  unit: 'просмотров',
                  series: [{ key: 'views', label: 'Просмотры' }],
                  rows: webSources.map((s) => ({
                    id: s.id,
                    name: s.name,
                    values: [
                      webMaterialMetrics(
                        visits.filter((v) => v.source === s.id),
                        [selectedMaterial.id],
                      ).views,
                    ],
                  })),
                }}
              />
            )}
            <div className="modal-actions">
              <Button variant="secondary" onClick={() => setSelected(null)}>
                Закрыть
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
