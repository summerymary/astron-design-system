import { useState } from 'react';
import { Download, RotateCcw } from 'lucide-react';
import type { Member, Visit } from '../types';
import { useWorkspace } from '../components/WorkspaceProvider';
import { Back, DataTable, Empty, Notice, Stats } from '../components/WorkspaceUI';
import { Button } from '../components/ui';
import { Select } from '../components/Select';
import { ReportCatalogue } from '../components/ReportCatalogue';
import { ReportBars } from '../components/ReportBars';
import { statisticsReports, reportTitle, reportPending } from '../data/statistics';
import { TODAY, prettyDate, money } from '../data/workspace';
import { buildStatistics, defaultReportFilters, statisticsCsv } from '../lib/statistics';
import type { ReportFilters } from '../lib/statistics';
import '../styles/statistics.css';

export function StatisticsWorkspace({
  members,
  visits,
  reportId,
  onReport,
  onMember,
  hidePhones = false,
}: {
  members: Member[];
  visits: Visit[];
  reportId: string | null;
  onReport: (id: string | null) => void;
  onMember: (member: Member) => void;
  hidePhones?: boolean;
}) {
  const report = statisticsReports.find((r) => r.id === reportId);
  if (!reportId)
    return (
      <div className="ws-stack">
        <p className="ws-muted">Клиенты, тренеры и продажи · демонстрационные данные</p>
        <ReportCatalogue reports={statisticsReports} onOpen={onReport} />
      </div>
    );
  if (!report)
    return (
      <Empty
        title="Такого отчёта нет"
        action={<Button onClick={() => onReport(null)}>Все отчёты</Button>}
      />
    );
  return (
    <StatisticsReport
      key={report.id}
      id={report.id}
      members={members}
      visits={visits}
      onBack={() => onReport(null)}
      onMember={onMember}
      hidePhones={hidePhones}
    />
  );
}

function StatisticsReport({
  id,
  members,
  visits,
  onBack,
  onMember,
  hidePhones,
}: {
  id: string;
  members: Member[];
  visits: Visit[];
  onBack: () => void;
  onMember: (member: Member) => void;
  hidePhones: boolean;
}) {
  const { data } = useWorkspace();
  const defaults = { ...defaultReportFilters, threshold: id === 'notcame' ? '0' : '21' };
  const [filters, setFilters] = useState<ReportFilters>(defaults);
  const report = statisticsReports.find((r) => r.id === id)!;
  const output = buildStatistics(id, filters, {
    members,
    visits,
    data,
    hidePhones,
    at: `${TODAY}T14:35`,
  });
  const chartBlock = output.blocks[0];
  const chartKey =
    id === 'gtrener_rating'
      ? 'occupancy'
      : id === 'ptrener_rating_all'
        ? 'hours'
        : report.group === 'sales'
          ? 'amount'
          : id === 'unique_visits'
            ? 'clients'
            : 'count';
  const chartColumn = chartBlock?.columns.find((c) => c.key === chartKey);
  const chartRows =
    chartColumn && !chartBlock.memberLinks
      ? chartBlock.rows
          .slice(0, 12)
          .map((r) => ({
            id: r.id,
            name: r.month ? `${r.month} · ${r.name}` : r.name,
            value: Number(r[chartKey]),
            label:
              chartColumn.format === 'money'
                ? money(Number(r[chartKey]) / 100)
                : `${r[chartKey]}${chartColumn.format === 'percent' ? '%' : ''}`,
          }))
          .filter((r) => Number.isFinite(r.value) && r.value >= 0)
      : [];
  const update = (key: keyof ReportFilters, value: string) =>
    setFilters((f) => ({ ...f, [key]: value, ...(key === 'to' && asOf ? { from: value } : {}) }));
  const field = (key: keyof ReportFilters, label: string, type = 'date') => (
    <label className="form-field" key={key}>
      <span>{label}</span>
      <input
        type={type}
        value={filters[key]}
        onInput={(e) => update(key, e.currentTarget.value)}
        onChange={(e) => update(key, e.target.value)}
        {...(type === 'number' ? { min: 0, step: 1 } : {})}
      />
    </label>
  );
  const choice = (
    key: keyof ReportFilters,
    label: string,
    options: { id: string; name: string }[],
  ) => (
    <label className="form-field" key={key}>
      <span>{label}</span>
      <Select value={filters[key]} onChange={(e) => update(key, e.target.value)}>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </Select>
    </label>
  );
  const noPeriod = ['report_all_clients_phones'].includes(id);
  const asOf = [
    'clients_active',
    'client_never',
    'birdthday',
    'client_lastvisit',
    'client_lastvisit_personal',
    'report_pclients_lost',
  ].includes(id);
  const noClub = [
    'birdthday',
    'clients_new',
    'newclients',
    'newclients_source',
    'clients_active',
    'report_all_clients_phones',
    'calls',
    'report_pclients_lost',
  ].includes(id);
  const showKind = [
    'client_never',
    'client_lastvisit',
    'timetoabstat',
    'clients_gender_age',
    'unique_visits',
    'clients_rating_visit',
    'visit_by_period',
  ].includes(id);
  const exportRows = () => {
    // Human-facing CSV uses displayed units; domain tables keep numeric kopecks for sorting.
    const blocks = output.blocks.map((b) => ({
      ...b,
      columns: b.columns.map((c) => ({
        ...c,
        label: c.format === 'money' ? `${c.label}, ₽` : c.label,
      })),
      rows: b.rows.map(
        (r) =>
          Object.fromEntries(
            Object.entries(r).map(([key, value]) => [
              key,
              b.columns.find((c) => c.key === key)?.format === 'money'
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
    link.download = `astron-${id}-${filters.to}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };
  return (
    <div className="ws-stack statistics-report">
      <div className="ws-subheading">
        <Back onClick={onBack}>Все отчёты</Back>
        <div className="ws-actions">
          {!reportPending[id] && (
            <Button variant="ghost" onClick={() => setFilters(defaults)}>
              <RotateCcw size={16} />
              Сбросить
            </Button>
          )}
          <Button
            variant="secondary"
            onClick={exportRows}
            disabled={
              Boolean(output.error || output.pending) || !output.blocks.some((b) => b.rows.length)
            }
          >
            <Download size={18} />
            Скачать CSV
          </Button>
        </div>
      </div>
      <section className="panel ws-panel">
        <div className="ws-panel-heading statistics-report-heading">
          <div>
            <h2>{reportTitle(report)}</h2>
          </div>
        </div>
        {!reportPending[id] && (
          <div className="ws-toolbar statistics-filters">
            {!noPeriod && (
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
            {showKind &&
              choice('kind', 'Направление', [
                { id: 'all', name: 'Все направления' },
                { id: 'gym', name: 'Тренажёрный зал' },
                { id: 'group', name: 'Групповые занятия' },
                { id: 'personal', name: 'Персональные тренировки' },
                { id: 'online', name: 'Онлайн-тренировки' },
              ])}
            {report.group === 'trainers' &&
              choice('trainer', 'Тренер', [
                { id: 'all', name: 'Все тренеры' },
                ...(data['trainer-profiles'] || []).map((t) => ({ id: t.id, name: t.name })),
              ])}
            {['clients_rating', 'clients_rating_visit'].includes(id) &&
              field('limit', 'Показать первых', 'number')}
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
                {choice('compare', 'Сравнение', [
                  { id: 'none', name: 'Без сравнения' },
                  { id: 'previous', name: 'Предыдущий период' },
                ])}
              </>
            )}
            {['notcame', 'client_lastvisit', 'client_lastvisit_personal'].includes(id) &&
              field(
                'threshold',
                id === 'notcame' ? 'Пропусков более' : 'Дней без визитов более',
                'number',
              )}
            {id === 'clients_new' &&
              choice('criterion', 'Считать новыми по', [
                { id: 'registration', name: 'Дате регистрации' },
                { id: 'visit', name: 'Первому известному визиту' },
                { id: 'purchase', name: 'Первой известной покупке' },
              ])}
            {['timetoabstat', 'clients_gender_age'].includes(id) && (
              <>
                {choice('gender', 'Пол', [
                  { id: 'all', name: 'Любой' },
                  { id: 'Женский', name: 'Женский' },
                  { id: 'Мужской', name: 'Мужской' },
                ])}
                {field('ageFrom', 'Возраст от', 'number')}
                {field('ageTo', 'Возраст до', 'number')}
                {id === 'timetoabstat' && (
                  <>
                    {field('timeFrom', 'Время с', 'time')}
                    {field('timeTo', 'Время до', 'time')}
                  </>
                )}
              </>
            )}
          </div>
        )}
      </section>
      <p className="ws-muted statistics-data-note">
        Демоданные · {prettyDate(TODAY)} · московское время · ₽
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
          <Stats items={output.metrics} />
          {chartRows.length > 0 && (
            <section className="panel ws-panel-body ws-stack">
              <h3>
                {chartBlock.title} · {chartColumn!.label.toLocaleLowerCase('ru')}
              </h3>
              <ReportBars rows={chartRows} unit={chartColumn!.label} />
              {chartBlock.rows.length > 12 && (
                <p className="ws-muted">Первые 12 групп; полный результат в таблице ниже.</p>
              )}
            </section>
          )}
          {output.blocks.map((block, index) => (
            <section className="panel ws-panel" key={`${id}-${index}`}>
              <div className="ws-panel-heading">
                <h3>{block.title}</h3>
                <span className="ws-muted">Строк: {block.rows.length}</span>
              </div>
              <DataTable
                rows={block.rows}
                columns={block.columns.map((c) => ({
                  ...c,
                  render: c.format
                    ? (r) =>
                        c.format === 'money'
                          ? money(Number(r[c.key]) / 100)
                          : c.format === 'date'
                            ? r[c.key]
                              ? prettyDate(r[c.key])
                              : '—'
                            : `${r[c.key]}%`
                    : undefined,
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
            </section>
          ))}
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
