import {
  transferReportFilters,
  reportHasClub,
  reportHasTrainer,
  reportPeriodMode,
} from '../lib/statistics-navigation';
import { CallJournal } from '../components/CallJournal';
import { ReviewJournal } from '../components/ReviewJournal';
import { Field } from '../components/Field';
import { useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { reportFamily } from '../data/report-families';
import { ReportFilterBar } from '../components/ReportFilterBar';
import { PhoneAction, RowActions } from '../components/RecordActions';
import { displayNumber, displayDuration } from '../lib/display-format';
import type { Navigate } from '../components/WorkspaceUI';
import { Download, RotateCcw } from 'lucide-react';
import type { Member, Visit } from '../types';
import { useWorkspace } from '../components/WorkspaceProvider';
import { DataTable, Empty, Notice, Stats, Tabs } from '../components/WorkspaceUI';
import { Button } from '../components/ui';
import { CallDialog } from '../components/CallDialog';
import { clientSegments } from '../lib/client-segments';
import type { DemoRecord } from '../data/workspace';
import type { ReportColumn } from '../lib/statistics';
import { Select } from '../components/Select';
import { ReportCatalogue } from '../components/ReportCatalogue';
import { ReportChart } from '../components/ReportChart';
import { ReportMonthPicker } from '../components/ReportMonthPicker';
import { ReportWeekPicker } from '../components/ReportWeekPicker';
import { reportMonth } from '../lib/report-period';
import { demoStamp, registrationNow } from '../lib/demo-clock';
import { statisticsCharts } from '../lib/statistics-charts';
import { isClientRating, statisticsReports, reportTitle, reportPending } from '../data/statistics';
import { TODAY, prettyDate, money } from '../data/workspace';
import { getClientProfile } from '../data/clientProfile';
import { buildStatistics, defaultReportFilters, statisticsCsv } from '../lib/statistics';
import type { ReportFilters } from '../lib/statistics';
import '../styles/statistics.css';

function reportDefaults(id: string): ReportFilters {
  return {
    ...defaultReportFilters,
    threshold: isClientRating(id) ? '3' : id === 'client_lifetime' ? '30' : '21',
    ...(['visit_by_period', 'financeresult'].includes(id) ? reportMonth(TODAY.slice(0, 7)) : {}),
    ...(id === 'free_trener_find' ? { timeFrom: '14:00' } : {}),
    ...(id === 'gt_finance' ? { grouping: 'trainer', groupByTrainer: '1' } : {}),
    ...(id === 'selling_clients_secondary_summer' ? { from: '1900-01-01' } : {}),
    ...(['trener_financial_result', 'finbyyear', 'finbyyear_by_abonements'].includes(id)
      ? {
          from: `${TODAY.slice(0, 4)}-01-01`,
          to:
            id === 'trener_financial_result'
              ? reportMonth(TODAY.slice(0, 7))!.to
              : `${TODAY.slice(0, 4)}-12-31`,
        }
      : {}),
  };
}

export function StatisticsWorkspace({
  members,
  visits,
  reportId,
  onReport,
  onMember,
  hidePhones = false,
  navigate,
  allowedTargets,
}: {
  members: Member[];
  visits: Visit[];
  reportId: string | null;
  onReport: (id: string | null) => void;
  onMember: (member: Member) => void;
  hidePhones?: boolean;
  navigate?: Navigate;
  allowedTargets?: string[];
}) {
  const report = statisticsReports.find((r) => r.id === reportId);
  if (!reportId)
    return (
      <div className="ws-stack">
        <p className="ws-muted">Аналитика по задачам · демонстрационные данные</p>
        <ReportCatalogue reports={statisticsReports} onOpen={onReport} />
      </div>
    );
  if (!report)
    return (
      <Empty
        title="Такого отчёта нет"
        action={<Button onClick={() => onReport(null)}>Вернуться к статистике</Button>}
      />
    );
  return (
    <StatisticsReport
      key={reportFamily(report.id).id}
      id={report.id}
      onReport={onReport}
      members={members}
      visits={visits}
      onMember={onMember}
      hidePhones={hidePhones}
      navigate={navigate}
      allowedTargets={allowedTargets}
    />
  );
}

function StatisticsReport({
  id,
  onReport,
  members,
  visits,
  onMember,
  hidePhones,
  navigate,
  allowedTargets,
}: {
  id: string;
  onReport: (id: string | null) => void;
  members: Member[];
  visits: Visit[];
  onMember: (member: Member) => void;
  hidePhones: boolean;
  navigate?: Navigate;
  allowedTargets?: string[];
}) {
  const { data } = useWorkspace();
  const defaults = reportDefaults(id);
  const family = reportFamily(id);
  const [storedFilters, storeFilters] = useState<Record<string, ReportFilters>>({});
  const filters = storedFilters[id] || defaults;
  const setFilters: Dispatch<SetStateAction<ReportFilters>> = (action) =>
    storeFilters((current) => ({
      ...current,
      [id]: typeof action === 'function' ? action(current[id] || defaults) : action,
    }));
  const report = statisticsReports.find((r) => r.id === id)!;
  const output = buildStatistics(id, filters, {
    members,
    visits,
    data,
    hidePhones,
    at: demoStamp(registrationNow()),
  });
  const charts = statisticsCharts(id, output, filters);
  const [view, setView] = useState('');
  const [detail, setDetail] = useState('');
  const [cohort, setCohort] = useState<{ age: string; gender: string } | null>(null);
  const [chartMeasure, setChartMeasure] = useState('amount');
  const [matrixMeasure, setMatrixMeasure] = useState('expense');
  const [call, setCall] = useState<{ name: string; phone: string } | null>(null);
  useEffect(() => {
    setView('');
    setDetail('');
    setCohort(null);
    setChartMeasure('amount');
    setMatrixMeasure('expense');
  }, [id]);
  const views =
    id === 'unique_visits'
      ? [
          { id: 'Все направления', label: 'Все посетители' },
          { id: 'Персональные посещения', label: 'Персональные' },
          { id: 'Другие направления', label: 'Неперсональные' },
          { id: 'Клиенты по числу клубов', label: 'Посещаемые клубы' },
        ]
      : id === 'timetoabstat'
        ? [
            { id: 'По клубам', label: 'Клубы' },
            { id: 'По направлению', label: 'Типы посещений' },
            { id: 'По полу', label: 'Пол' },
            { id: 'По возрасту', label: 'Возраст' },
            { id: 'Популярность групповых программ', label: 'Программы' },
            { id: 'По типам абонементов', label: 'Типы абонементов' },
            { id: 'По названиям абонементов', label: 'Названия абонементов' },
          ]
        : ['clients_ltv', 'clients_ltv_bydate'].includes(id)
          ? [
              { id: 'Сводка LTV', label: 'Сводка' },
              { id: 'Расходы клиентов с лицевых счетов', label: 'Клиенты' },
            ]
          : id === 'fincredits'
            ? [
                { id: 'Сводка обязательств перед клиентами', label: 'Сводка' },
                { id: 'Положительные остатки лицевых счетов', label: 'Лицевые счета' },
                { id: 'Активные подарочные карты', label: 'Подарочные карты' },
                { id: 'Неиспользованная стоимость абонементов', label: 'Абонементы' },
              ]
            : id === 'trener_financial_result'
              ? [
                  { id: 'Накопительный результат ПТ', label: 'Накопительно' },
                  { id: 'Результат по тренерам и месяцам', label: 'По месяцам' },
                  { id: 'Итоги ПТ за выбранный период', label: 'Итоги' },
                ]
              : ['selling_clients_secondary_summer', 'selling_clients_afterguest'].includes(id)
                ? [
                    { id: 'Итоги по годам', label: 'По годам' },
                    { id: 'Покупка следующей карты', label: 'Клиенты' },
                  ]
                : id === 'unlim_avg_visit'
                  ? [
                      { id: 'Частота визитов', label: 'Частота посещений' },
                      { id: 'Визиты по безлимитным картам', label: 'Клиенты' },
                    ]
                  : [];
  const activeIndex = Number.isInteger(Number(view)) && views[Number(view)] ? Number(view) : 0;
  const activeView = views[activeIndex]?.id;
  let visibleBlocks = output.blocks
    .filter((block) => (detail ? block.detail === detail : !block.detail))
    .sort((a, b) =>
      id === 'clients_sell_discount'
        ? Number(b.title === 'Продажи по скидкам') - Number(a.title === 'Продажи по скидкам')
        : 0,
    )
    .filter((block) =>
      id === 'clients_segmetation'
        ? block.title === (filters.segment === 'all' ? 'Сегменты базы' : 'Клиенты сегмента')
        : id === 'clients_gender_age'
          ? block.title === (cohort ? 'Клиенты по полу и возрасту' : 'По полу и возрасту')
          : true,
    )
    .map((block) =>
      cohort && id === 'clients_gender_age'
        ? {
            ...block,
            rows: block.rows.filter(
              (r) => r.ageKey === cohort.age && r.genderKey === cohort.gender,
            ),
          }
        : block,
    )
    .filter(
      (block) =>
        !activeView ||
        detail ||
        block.title === activeView ||
        (id === 'unique_visits' &&
          activeView === 'Все направления' &&
          block.title === 'Клиенты по числу клубов') ||
        (activeView === 'Популярность групповых программ' &&
          block.title === 'Направления групповых программ'),
    );
  let visibleCharts = charts
    .filter(() => !detail)
    .filter(
      () =>
        !(id === 'clients_gender_age' && cohort) &&
        !(id === 'clients_segmetation' && filters.segment !== 'all'),
    )
    .filter(
      (chart) =>
        !activeView ||
        (id === 'unlim_avg_visit' && activeView === 'Частота визитов') ||
        (['selling_clients_secondary_summer', 'selling_clients_afterguest'].includes(id) &&
          activeView === 'Итоги по годам') ||
        chart.title === activeView ||
        (id === 'unique_visits' &&
          ['Все направления', 'Клиенты по числу клубов'].includes(activeView)),
    );

  const measureOptions = ['selling_stat', 'finbyyear_by_abonements'].includes(id)
    ? [
        { id: 'amount', name: 'Сумма' },
        { id: 'count', name: 'Количество' },
        { id: 'share', name: 'Доля выручки' },
      ]
    : id === 'clients_sell_gender_age'
      ? [
          { id: 'amount', name: 'Сумма' },
          { id: 'average', name: 'Средний чек' },
          { id: 'count', name: 'Количество покупок' },
        ]
      : [];
  if (measureOptions.length) {
    if (id === 'clients_sell_gender_age') {
      const title =
        chartMeasure === 'average'
          ? 'Средний чек по полу и возрасту'
          : chartMeasure === 'count'
            ? 'Количество покупок по полу и возрасту'
            : 'Сумма покупок по полу и возрасту';
      visibleCharts = visibleCharts.filter((c) => c.title === title);
      visibleBlocks = visibleBlocks.filter((b) => b.title === title);
    } else visibleCharts = visibleCharts.filter((c) => c.series[0]?.key === chartMeasure);
  }
  visibleBlocks = visibleBlocks.map((block) => {
    if (id === 'feedbacks')
      return {
        ...block,
        columns: [
          { key: 'date', label: 'Дата', format: 'date' },
          { key: 'name', label: 'Клиент' },
          { key: 'club', label: 'Клуб' },
          { key: 'text', label: 'Отзыв' },
          { key: 'operator', label: 'Сотрудник' },
          { key: 'rating', label: 'Оценка' },
        ],
      };
    if (
      block.columns.some((c) => c.key === 'buyers') &&
      block.columns.some((c) => c.key === 'operations')
    )
      return {
        ...block,
        columns: [
          ...block.columns.filter((c) => !['buyers', 'operations'].includes(c.key)),
          { key: 'actions', label: 'Действия' },
        ],
      };
    if (block.title === 'Накопительный результат ПТ' && matrixMeasure !== 'all')
      return {
        ...block,
        columns: block.columns
          .filter(
            (c) =>
              ['name', 'category', matrixMeasure].includes(c.key) ||
              c.key.endsWith(':' + matrixMeasure),
          )
          .map((c) =>
            c.key.includes(':')
              ? {
                  ...c,
                  label: new Intl.DateTimeFormat('ru', {
                    month: 'short',
                    year: '2-digit',
                    timeZone: 'UTC',
                  }).format(new Date(c.key.split(':')[0] + '-01')),
                }
              : c,
          ),
      };
    return block;
  });
  if (id === 'trener_financial_result' && filters.trainer !== 'all') {
    const row = output.blocks
      .find((b) => b.title === 'Накопительный результат ПТ')
      ?.rows.find((r) => r.id === filters.trainer);
    if (row) {
      const metric = matrixMeasure === 'all' ? 'amount' : matrixMeasure;
      const months = Object.keys(row)
        .filter((k) => k.endsWith(':' + metric))
        .sort();
      visibleCharts.push({
        id: 'trainer-trend',
        title: 'Динамика выбранного тренера',
        unit: metric === 'percent' ? '%' : '₽',
        kind: 'lines',
        format: metric === 'percent' ? 'percent' : 'money',
        series: [
          {
            key: metric,
            label:
              metric === 'expense' ? 'Оплата' : metric === 'amount' ? 'Продажи ПТ' : 'Доля оплаты',
          },
        ],
        rows: months.map((k) => ({
          id: k,
          name: new Intl.DateTimeFormat('ru', { month: 'short', timeZone: 'UTC' }).format(
            new Date(k.split(':')[0] + '-01'),
          ),
          values: [row[k] === '' ? null : Number(row[k])],
        })),
      });
    }
  }

  const update = (key: keyof ReportFilters, value: string) => {
    setCohort(null);
    setDetail('');
    setFilters((f) => ({
      ...f,
      [key]: value,
      ...(key === 'to' && asOf ? { from: value } : {}),
      ...(id === 'gt_finance' && key === 'grouping'
        ? { groupByTrainer: value === 'trainer' ? '1' : '0' }
        : {}),
    }));
  };
  const field = (key: keyof ReportFilters, label: string, type = 'date') => (
    <Field className="form-field" data-filter={key} key={key} label={<> {label} </>}>
      <input
        type={type}
        value={filters[key]}
        onInput={(e) => update(key, e.currentTarget.value)}
        onChange={(e) => update(key, e.target.value)}
        {...(type === 'number' ? { min: 0, step: 1 } : {})}
      />
    </Field>
  );
  const choice = (
    key: keyof ReportFilters,
    label: string,
    options: { id: string; name: string }[],
  ) => (
    <Field className="form-field" data-filter={key} key={key} label={label}>
      <Select value={filters[key]} onChange={(e) => update(key, e.target.value)}>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </Select>
    </Field>
  );
  const flag = (key: keyof ReportFilters, label: string) => (
    <label className="ws-checkbox" data-filter={key} key={key}>
      <input
        type="checkbox"
        checked={filters[key] === '1'}
        onChange={(e) => update(key, e.target.checked ? '1' : '0')}
      />
      {label}
    </label>
  );
  const noPeriod = [
    'financeresult',
    'trener_financial_result',
    'selling_clients_secondary_summer',
    'client_lifetime',
    'clients_ltv',
    'birdthday',
    'visit_by_period',
    'fincredits',
    'report_all_clients_phones',
  ].includes(id);
  const asOf = [
    'clients_active',
    'client_never',
    'birdthday',
    'client_lastvisit',
    'client_lastvisit_personal',
    'free_trener_find',
    'clients_segmetation',
    'gtrener_busy',
  ].includes(id);
  const noClub = !reportHasClub(id);
  const showKind = [
    'client_lastvisit',
    'timetoabstat',
    'clients_gender_age',
    'unique_visits',
    'clients_rating_visit',
    'visit_by_period',
  ].includes(id);
  const exportRows = () => {
    // Human-facing CSV uses displayed units; domain tables keep numeric kopecks for sorting.
    const blocks = visibleBlocks.map((b) => ({
      ...b,
      columns: b.columns
        .filter((c) => !['buyers', 'operations', 'actions'].includes(c.key))
        .map((c) => ({
          ...c,
          label: c.format === 'money' ? `${c.label}, ₽` : c.label,
        })),
      rows: b.rows.map(
        (r) =>
          Object.fromEntries(
            Object.entries(r).map(([key, value]) => [
              key,
              id === 'calls' && key === 'duration'
                ? displayDuration(value)
                : b.columns.find((c) => c.key === key)?.format === 'money' && value !== ''
                  ? (Number(value) / 100).toLocaleString('ru-RU', {
                      useGrouping: false,
                      maximumFractionDigits: 2,
                    })
                  : value,
            ]),
          ) as typeof r,
      ),
    }));
    const url = URL.createObjectURL(
      new Blob([statisticsCsv(blocks)], { type: 'text/csv;charset=utf-8;' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `astron-${id}-${id === 'birdthday' ? demoStamp(registrationNow()).slice(0, 10) : filters.to}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };
  const renderCell = (r: DemoRecord, c: ReportColumn, title: string) => {
    if (c.key === 'actions')
      return (
        <RowActions
          label={`Действия: ${r.name}`}
          actions={[
            { label: 'Кто купил', onClick: () => setDetail(`${r.detailKey}:buyers`) },
            { label: 'Список операций', onClick: () => setDetail(`${r.detailKey}:operations`) },
          ]}
        />
      );
    if (id === 'unlim_avg_visit' && title === 'Частота визитов' && c.key === 'count')
      return (
        <Button
          variant="ghost"
          disabled={!Number(r.count)}
          onClick={() => setDetail(r.detailKey)}
          aria-label={`Показать клиентов: ${r.name}`}
        >
          {r.count} · Подробнее
        </Button>
      );
    if (id === 'selling_clients_afterguest' && c.key === 'status')
      return r.status === 'Продлил' ? 'Купил карту' : 'Нет покупки к дате среза';
    if (r.detailKey && ['buyers', 'operations'].includes(c.key))
      return (
        <Button variant="ghost" onClick={() => setDetail(`${r.detailKey}:${c.key}`)}>
          {c.key === 'buyers' ? 'Кто купил' : 'Список операций'}
        </Button>
      );
    if (id === 'gtrener_busy' && /^day[0-6]$/.test(c.key))
      return r[c.key] ? (
        <div className="statistics-week-cell">
          {r[c.key].split('\n\n').map((entry, i) => {
            const [lesson, place] = entry.split('\n');
            return (
              <div key={i}>
                <strong>{lesson}</strong>
                <span className="ws-muted">{place}</span>
              </div>
            );
          })}
        </div>
      ) : (
        '—'
      );
    if (id === 'clients_segmetation' && title === 'Сегменты базы' && c.key === 'count')
      return (
        <Button
          variant="ghost"
          disabled={!Number(r.count)}
          onClick={() => update('segment', r.id)}
          aria-label={`Подробнее: ${r.name}`}
        >
          {r.count} · Подробнее
        </Button>
      );
    if (
      id === 'clients_gender_age' &&
      title === 'По полу и возрасту' &&
      /^(male|female|unknown)(Clients)?$/.test(c.key)
    )
      return (
        <Button
          variant="ghost"
          disabled={!Number(r[c.key])}
          onClick={() => setCohort({ age: r.id, gender: c.key.replace('Clients', '') })}
          aria-label={`Показать клиентов: ${r.name}, ${c.label}`}
        >
          {r[c.key]}
        </Button>
      );
    if (id.startsWith('report_pclients') && c.key === 'phone') {
      const phone = members.find((m) => String(m.id) === r.memberId)?.phone;
      return phone ? (
        <PhoneAction
          name={r.name}
          phone={r.phone}
          onClick={() => setCall({ name: r.name, phone })}
        />
      ) : (
        '—'
      );
    }
    const formatted =
      r[c.key] === '' || r[c.key] === undefined
        ? '—'
        : c.format === 'money'
          ? money(Number(r[c.key]) / 100)
          : c.format === 'date'
            ? prettyDate(r[c.key])
            : c.format === 'percent'
              ? `${Number(r[c.key]).toLocaleString('ru-RU', { maximumFractionDigits: 2 })}%`
              : displayNumber(r[c.key]);
    return r.rowKind === 'profit' ? <strong>{formatted}</strong> : formatted;
  };
  return (
    <div className="ws-stack statistics-report">
      <div className="ws-subheading statistics-report-actions">
        <div className="ws-actions">
          {!reportPending[id] && (
            <Button
              variant="ghost"
              onClick={() => {
                setFilters(defaults);
                setCohort(null);
              }}
            >
              <RotateCcw size={16} />
              Сбросить
            </Button>
          )}
          <Button
            variant="secondary"
            onClick={exportRows}
            disabled={
              Boolean(output.error || output.pending) || !visibleBlocks.some((b) => b.rows.length)
            }
          >
            <Download size={18} />
            Скачать CSV
          </Button>
        </div>
      </div>
      {call && <CallDialog {...call} hidden={hidePhones} onClose={() => setCall(null)} />}
      {detail && (
        <Button variant="secondary" onClick={() => setDetail('')}>
          ← К сводке отчёта
        </Button>
      )}
      <section className="panel ws-panel">
        <div className="ws-panel-heading statistics-report-heading">
          <div>
            <h2>{family.title}</h2>
            {reportTitle(report) !== family.title && (
              <p className="ws-muted">{reportTitle(report)}</p>
            )}
          </div>
          {family.target &&
            navigate &&
            (!allowedTargets || allowedTargets.includes(family.target)) && (
              <Button variant="ghost" onClick={() => navigate(family.target!)}>
                Открыть{' '}
                {family.target === 'schedule'
                  ? 'расписание'
                  : family.target === 'calls'
                    ? 'общий журнал звонков'
                    : family.target === 'reviews'
                      ? 'общий журнал отзывов'
                      : family.target === 'members'
                        ? 'клиентскую базу'
                        : 'кассу'}
              </Button>
            )}
        </div>
        {family.reports.length > 1 && (
          <Tabs
            label="Раздел аналитики"
            value={id === 'newclients' ? 'clients_new' : id}
            items={family.reports.filter((r) => !r.hidden)}
            onChange={(nextId) => {
              storeFilters((current) => ({
                ...current,
                [id]: filters,
                [nextId]: transferReportFilters(
                  id,
                  nextId,
                  filters,
                  current[nextId] || reportDefaults(nextId),
                ),
              }));
              setView('');
              setDetail('');
              setCohort(null);
              setChartMeasure('amount');
              onReport(nextId);
            }}
          />
        )}
        {!reportPending[id] && id !== 'birdthday' && (
          <ReportFilterBar
            activeCount={
              Object.keys(defaults).filter(
                (key) =>
                  ![
                    'from',
                    'to',
                    'club',
                    'trainer',
                    'kind',
                    'criterion',
                    'threshold',
                    'plan',
                  ].includes(key) &&
                  filters[key as keyof ReportFilters] !== defaults[key as keyof ReportFilters],
              ).length
            }
          >
            {['visit_by_period', 'financeresult', 'trener_financial_result'].includes(id) && (
              <ReportMonthPicker
                month={(id === 'trener_financial_result' ? filters.to : filters.from).slice(0, 7)}
                label={
                  id === 'trener_financial_result'
                    ? 'Накопительно по месяц включительно'
                    : 'Месяц и год'
                }
                onChange={(month) => {
                  const period = reportMonth(month);
                  if (period)
                    setFilters((current) => ({
                      ...current,
                      ...period,
                      ...(id === 'trener_financial_result'
                        ? { from: month.slice(0, 4) + '-01-01' }
                        : {}),
                    }));
                }}
              />
            )}
            {id === 'gtrener_busy' && (
              <ReportWeekPicker day={filters.to} onChange={(day) => update('to', day)} />
            )}
            {!noPeriod && id !== 'gtrener_busy' && (
              <>
                {!asOf && field('from', 'С даты')}
                {field('to', asOf ? 'На дату' : 'По дату включительно')}
              </>
            )}
            {!noClub &&
              choice('club', 'Клуб', [
                { id: 'all', name: 'Все клубы' },
                ...['Центральный', 'Парк', 'Речной'].map((name) => ({ id: name, name })),
              ])}
            {id === 'client_never' &&
              choice('kind', 'Не посещали', [
                { id: 'all', name: 'Тренажёрный зал и ПТ' },
                { id: 'personal', name: 'Персональные тренировки' },
                { id: 'group', name: 'Групповые занятия' },
              ])}
            {showKind &&
              choice('kind', 'Направление', [
                { id: 'all', name: 'Все направления' },
                { id: 'gym', name: 'Тренажёрный зал' },
                { id: 'group', name: 'Групповые занятия' },
                { id: 'personal', name: 'Персональные тренировки' },
                { id: 'online', name: 'Онлайн-тренировки' },
              ])}
            {reportHasTrainer(id) &&
              choice('trainer', 'Тренер', [
                { id: 'all', name: 'Все тренеры' },
                ...(data['trainer-profiles'] || []).map((t) => ({ id: t.id, name: t.name })),
              ])}
            {['clients_active', 'selltovosit', 'selling_clients_secondary'].includes(id) && (
              <>
                {flag('includePersonal', 'Включать персональные тренировки')}
                {id !== 'selling_clients_secondary' &&
                  flag('includeSingle', 'Включать разовые и гостевые')}
                {flag('includeCorporate', 'Включать корпоративные')}
                {id === 'clients_active' && flag('onlyUnlimited', 'Только безлимитные')}
              </>
            )}
            {['clients_new', 'newclients', 'newclients_source'].includes(id) && (
              <>
                {choice('source', 'Источник', [
                  { id: 'all', name: 'Любой источник' },
                  ...[...new Set(members.map((m) => getClientProfile(m, data).source))].map(
                    (name) => ({ id: name, name }),
                  ),
                ])}
                {flag('onlyOnline', 'Зарегистрировался онлайн')}
                {flag('onlyNoPurchase', 'Ничего не купил')}
              </>
            )}
            {id === 'selling_clients_new' && (
              <>
                {flag('includePersonal', 'Считать персональные тренировки')}
                {flag('includeSingle', 'Считать разовые посещения')}
              </>
            )}
            {id === 'selling_stat' && (
              <>
                {choice('salesSort', 'Сортировать', [
                  { id: 'count', name: 'По количеству продаж' },
                  { id: 'amount', name: 'По сумме продаж' },
                ])}
                {flag('includeMemberships', 'Количественные и безлимитные')}
                {flag('includePersonal', 'Персональные тренировки')}
                {flag('includeSingle', 'Разовые посещения')}
                {flag('includeCorporate', 'Корпоративные')}
                {flag('includeGoods', 'Товары и услуги')}
              </>
            )}
            {id === 'kassacontrol' &&
              choice('payment', 'Вид оплаты / операции', [
                { id: 'all', name: 'Любая · касса №1' },
                { id: 'cash', name: 'Наличные' },
                { id: 'card', name: 'Банковская карта' },
                { id: 'website', name: 'Сайт' },
                { id: 'gift', name: 'Подарочная карта' },
                { id: 'credit', name: 'В кредит' },
                { id: 'deposit', name: 'Внесение' },
                { id: 'withdrawal', name: 'Снятие' },
                { id: 'refund', name: 'Возврат наличными' },
                { id: 'card-refund', name: 'Возврат на карту' },
              ])}
            {id === 'clients_sell_gender_age' &&
              flag('onlyPersonal', 'Только персональные тренировки')}
            {id === 'clients_segmetation' &&
              choice('segment', 'Сегмент', [
                { id: 'all', name: 'Сводные данные' },
                ...clientSegments.map((segment, i) => ({ id: String(i), name: segment.name })),
              ])}
            {id === 'feedbacks' &&
              choice('operator', 'Оператор', [
                { id: 'all', name: 'Все операторы' },
                ...[...new Set((data['client-reviews'] || []).map((r) => r.operator))].map(
                  (name) => ({ id: name, name }),
                ),
              ])}
            {id === 'calls' && (
              <>
                {choice('callStatus', 'Статус звонка', [
                  { id: 'all', name: 'Все статусы' },
                  ...[...new Set((data.calls || []).map((r) => r.status))].map((name) => ({
                    id: name,
                    name,
                  })),
                ])}
                {flag('onlyUnknown', 'Нет в базе клиентов')}
              </>
            )}
            {id === 'gt_finance' && (
              <>
                {choice('grouping', 'Представление', [
                  { id: 'trainer', name: 'По тренерам' },
                  { id: 'program', name: 'По программам' },
                  { id: 'events', name: 'Занятия' },
                ])}
                {choice('reportSort', 'Сортировать', [
                  { id: 'avg_visitors', name: 'По среднему числу посещений' },
                  { id: 'all_shedules', name: 'По количеству занятий' },
                  { id: 'all_visitors', name: 'По количеству посещений' },
                ])}
              </>
            )}
            {id === 'ptrener_rating_all' && (
              <>
                {flag('countPersonal', 'Считать ПТ')}
                {flag('countGroup', 'Считать групповые')}
                {flag('countDuty', 'Считать дежурные часы')}
              </>
            )}
            {id === 'free_trener_find' && (
              <>
                {field('timeFrom', 'Начало', 'time')}
                {field('duration', 'Длительность, минут', 'number')}
              </>
            )}
            {['client_lifetime', 'report_pclients_stat', 'report_pclients_lost'].includes(id) &&
              field('threshold', 'Интервал бездействия, дней', 'number')}
            {id === 'selling_clients_secondary' &&
              field('renewalDays', 'Демо-окно покупки, дней', 'number')}
            {id === 'unlim_avg_visit' &&
              choice('plan', 'Безлимитная карта', [
                { id: 'all', name: 'Все безлимитные' },
                ...[
                  ...new Set(
                    members.flatMap((m) =>
                      getClientProfile(m, data)
                        .subscriptions.filter((p) => p.remaining === null)
                        .map((p) => p.name),
                    ),
                  ),
                ].map((name) => ({ id: name, name })),
              ])}
            {isClientRating(id) && field('limit', 'Показать первых', 'number')}
            {id === 'clients_rating' &&
              choice('channel', 'Канал покупки', [
                { id: 'all', name: 'Любой' },
                { id: 'online', name: 'На сайте' },
                { id: 'offline', name: 'В клубе' },
              ])}
            {['selling_stat', 'finbyyear', 'finbyyear_by_abonements'].includes(id) && (
              <>
                {id !== 'finbyyear' &&
                  choice('grouping', 'Группировать', [
                    { id: 'plan', name: 'По позициям' },
                    { id: 'day', name: 'По дням' },
                    { id: 'club', name: 'По клубам' },
                    { id: 'category', name: 'По категориям' },
                  ])}
                {id !== 'selling_stat' &&
                  choice('compare', 'Сравнение', [
                    { id: 'none', name: 'Без сравнения' },
                    { id: 'previous', name: 'Предыдущий период' },
                  ])}
              </>
            )}
            {['notcame', 'client_lastvisit', 'client_lastvisit_personal'].includes(id) &&
              field(
                'threshold',
                id === 'notcame' ? 'Минимум пропусков' : 'Дней без визитов более',
                'number',
              )}
            {['clients_new', 'newclients', 'newclients_source', 'selling_clients_new'].includes(
              id,
            ) &&
              choice('criterion', 'Считать новыми по', [
                { id: 'registration', name: 'Дате регистрации' },
                { id: 'visit', name: 'Первому известному визиту' },
                { id: 'purchase', name: 'Первой известной покупке' },
              ])}
            {['timetoabstat', 'clients_gender_age'].includes(id) && (
              <>
                {id === 'clients_gender_age' && (
                  <>
                    {flag('uniqueOnly', 'Только уникальные клиенты')}
                    {flag('onlyPersonal', 'Только персональные тренировки')}
                  </>
                )}
                {choice('gender', 'Пол', [
                  { id: 'all', name: 'Любой' },
                  { id: 'Женский', name: 'Женский' },
                  { id: 'Мужской', name: 'Мужской' },
                ])}
                {field('ageFrom', 'Возраст от', 'number')}
                {field('ageTo', 'Возраст до', 'number')}
                {['timetoabstat', 'clients_gender_age'].includes(id) && (
                  <>
                    {field('timeFrom', 'Время с', 'time')}
                    {field('timeTo', 'Время до', 'time')}
                  </>
                )}
              </>
            )}
            {id === 'clients_gender_age' && (
              <fieldset className="statistics-clubs">
                <legend>Клубы · если ничего не выбрано, учитывается вся сеть</legend>
                {['Центральный', 'Парк', 'Речной'].map((club) => (
                  <label className="ws-checkbox" key={club}>
                    <input
                      type="checkbox"
                      checked={filters.clubs.split(',').includes(club)}
                      onChange={(e) =>
                        update(
                          'clubs',
                          e.target.checked
                            ? [...filters.clubs.split(',').filter(Boolean), club].join(',')
                            : filters.clubs
                                .split(',')
                                .filter((c) => c !== club)
                                .join(','),
                        )
                      }
                    />
                    {club}
                  </label>
                ))}
              </fieldset>
            )}
          </ReportFilterBar>
        )}
      </section>
      <p className="ws-muted statistics-data-note">
        Демоданные · сегодня {prettyDate(demoStamp(registrationNow()).slice(0, 10))} · московское
        время · ₽
        {['history', 'snapshot', 'week'].includes(reportPeriodMode(id)) && (
          <> · Срез: {prettyDate(filters.to)}</>
        )}
      </p>
      {output.error ? (
        <Notice tone="warning">{output.error}</Notice>
      ) : output.pending ? (
        <section className="panel ws-panel-body ws-stack">
          <h3>Уточняется методика расчёта</h3>
          <p>{output.pending}</p>
          <p className="ws-muted">
            Отчёт включён в каталог. Результат появится после согласования этих правил.
          </p>
        </section>
      ) : (
        <>
          {!!output.metrics.length && <Stats items={output.metrics} />}
          {cohort && id === 'clients_gender_age' && (
            <div className="ws-actions">
              <Button variant="secondary" onClick={() => setCohort(null)}>
                К диаграмме и сводке
              </Button>
              <span>
                {cohort.age === 'unknown' ? 'Возраст не указан' : `${cohort.age} лет`} ·{' '}
                {cohort.gender === 'male'
                  ? 'Мужчины'
                  : cohort.gender === 'female'
                    ? 'Женщины'
                    : 'Пол не указан'}
              </span>
            </div>
          )}
          {!!views.length && (
            <Tabs
              label="Разрез отчёта"
              value={String(activeIndex)}
              onChange={setView}
              items={views.map((item, index) => ({ ...item, id: String(index) }))}
              panelId="statistics-result"
              idPrefix="statistics-view"
            />
          )}
          {!!measureOptions.length && !detail && (
            <div className="statistics-chart-controls">
              <Field label="Показатель">
                <Select value={chartMeasure} onChange={(e) => setChartMeasure(e.target.value)}>
                  {measureOptions.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          )}
          {id === 'trener_financial_result' && activeView === 'Накопительный результат ПТ' && (
            <div className="statistics-chart-controls">
              <Field label="Показатель по месяцам">
                <Select value={matrixMeasure} onChange={(e) => setMatrixMeasure(e.target.value)}>
                  <option value="expense">Оплата тренеру</option>
                  <option value="amount">Продажи ПТ</option>
                  <option value="percent">Доля оплаты</option>
                  <option value="all">Все показатели</option>
                </Select>
              </Field>
            </div>
          )}
          {id === 'gt_finance' && (
            <Notice>
              В графике показан только известный доход. Занятия без сохранённой оценки не считаются
              нулевым доходом; тариф и число присутствовавших доступны в детализации.
            </Notice>
          )}
          <div
            className="ws-stack"
            id="statistics-result"
            role={views.length ? 'tabpanel' : undefined}
            aria-labelledby={views.length ? `statistics-view-${activeIndex}` : undefined}
          >
            {visibleCharts.map((chart) => (
              <ReportChart key={chart.id} chart={chart} />
            ))}
            {visibleBlocks.map((block, index) => (
              <section
                className={`panel ws-panel${id === 'gtrener_busy' ? ' statistics-week-table' : ''}${block.title === 'Накопительный результат ПТ' ? ' statistics-trainer-matrix' : ''}`}
                key={`${id}-${index}`}
              >
                <div className="ws-panel-heading">
                  <h3>{block.title}</h3>
                </div>
                {id === 'calls' ? (
                  <CallJournal
                    rows={block.rows.map((r) => ({
                      ...r,
                      phone:
                        data.calls?.find((c) => c.id === r.id)?.phone ||
                        members.find((m) => String(m.id) === r.memberId)?.phone ||
                        '',
                    }))}
                    members={members}
                    hidePhones={hidePhones}
                    onMember={onMember}
                    onCall={setCall}
                  />
                ) : id === 'feedbacks' ? (
                  <ReviewJournal rows={block.rows} members={members} onMember={onMember} />
                ) : (
                  <DataTable
                    rows={block.rows.filter((row) => row.id !== 'network-total')}
                    footerRows={block.rows.filter((row) => row.id === 'network-total')}
                    tableLabel={block.title}
                    columns={block.columns.map((c) => ({
                      ...c,
                      render: (r) => renderCell(r, c, block.title),
                    }))}
                    onOpen={
                      block.memberLinks &&
                      block.rows.every((r) => members.some((m) => String(m.id) === r.memberId))
                        ? (r) => {
                            const m = members.find((m) => String(m.id) === r.memberId);
                            if (m) onMember(m);
                          }
                        : undefined
                    }
                    empty={
                      <Empty
                        title="По выбранным условиям данных нет"
                        text="Выберите другой период или снимите часть фильтров."
                      />
                    }
                  />
                )}
              </section>
            ))}
          </div>
          <section className="panel ws-panel-body ws-stack statistics-method">
            <h3>Как читать отчёт</h3>
            <p>
              Результаты рассчитаны по данным в памяти прототипа. История неполная; отсутствие
              записи не доказывает, что события не было. Посещения и покупки, добавленные в этой
              сессии, учитываются сразу.
            </p>
            {output.notes.map((note) => (
              <p key={note}>{note}</p>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
