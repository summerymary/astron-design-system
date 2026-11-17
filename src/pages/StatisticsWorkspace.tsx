import { useState } from 'react';
import { Download, RotateCcw, Phone } from 'lucide-react';
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
import {
  clientRatingTabs,
  isClientRating,
  statisticsReports,
  reportTitle,
  reportPending,
} from '../data/statistics';
import { TODAY, prettyDate, money } from '../data/workspace';
import { getClientProfile } from '../data/clientProfile';
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
        action={<Button onClick={() => onReport(null)}>Вернуться к статистике</Button>}
      />
    );
  return (
    <StatisticsReport
      key={isClientRating(report.id) ? 'client-ratings' : report.id}
      id={report.id}
      onReport={onReport}
      members={members}
      visits={visits}
      onMember={onMember}
      hidePhones={hidePhones}
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
}: {
  id: string;
  onReport: (id: string | null) => void;
  members: Member[];
  visits: Visit[];
  onMember: (member: Member) => void;
  hidePhones: boolean;
}) {
  const { data } = useWorkspace();
  const defaults = {
    ...defaultReportFilters,
    threshold: isClientRating(id) ? '3' : id === 'client_lifetime' ? '30' : '21',
    ...(id === 'visit_by_period' ? reportMonth(TODAY.slice(0, 7)) : {}),
    ...(id === 'free_trener_find' ? { timeFrom: '14:00' } : {}),
    ...(['selling_clients_secondary_summer', 'trener_financial_result', 'financeresult'].includes(
      id,
    )
      ? { from: `${TODAY.slice(0, 4)}-01-01` }
      : {}),
  };
  const [filters, setFilters] = useState<ReportFilters>(defaults);
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
  const [cohort, setCohort] = useState<{ age: string; gender: string } | null>(null);
  const [call, setCall] = useState<{ name: string; phone: string } | null>(null);
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
        : [];
  const activeIndex = Number.isInteger(Number(view)) && views[Number(view)] ? Number(view) : 0;
  const activeView = views[activeIndex]?.id;
  const visibleBlocks = output.blocks
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
        block.title === activeView ||
        (id === 'unique_visits' &&
          activeView === 'Все направления' &&
          block.title === 'Клиенты по числу клубов') ||
        (activeView === 'Популярность групповых программ' &&
          block.title === 'Направления групповых программ'),
    );
  const visibleCharts = charts
    .filter(
      () =>
        !(id === 'clients_gender_age' && cohort) &&
        !(id === 'clients_segmetation' && filters.segment !== 'all'),
    )
    .filter(
      (chart) =>
        !activeView ||
        chart.title === activeView ||
        (id === 'unique_visits' &&
          ['Все направления', 'Клиенты по числу клубов'].includes(activeView)),
    );

  const update = (key: keyof ReportFilters, value: string) => {
    setCohort(null);
    setFilters((f) => ({ ...f, [key]: value, ...(key === 'to' && asOf ? { from: value } : {}) }));
  };
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
  const flag = (key: keyof ReportFilters, label: string) => (
    <label className="ws-checkbox" key={key}>
      <input
        type="checkbox"
        checked={filters[key] === '1'}
        onChange={(e) => update(key, e.target.checked ? '1' : '0')}
      />
      {label}
    </label>
  );
  const noPeriod = [
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
  const noClub = [
    'birdthday',
    'clients_new',
    'newclients',
    'newclients_source',
    'clients_active',
    'report_all_clients_phones',
    'clients_gender_age',
    'report_pclients_lost',
    'fincredits',
    'client_lifetime',
    'clients_segmetation',
  ].includes(id);
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
      columns: b.columns.map((c) => ({
        ...c,
        label: c.format === 'money' ? `${c.label}, ₽` : c.label,
      })),
      rows: b.rows.map(
        (r) =>
          Object.fromEntries(
            Object.entries(r).map(([key, value]) => [
              key,
              b.columns.find((c) => c.key === key)?.format === 'money' && value !== ''
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
    if (id === 'calls' && c.key === 'name') {
      const member = members.find((m) => String(m.id) === r.memberId);
      return member ? (
        <Button variant="ghost" onClick={() => onMember(member)}>
          {r.name}
        </Button>
      ) : (
        r.name
      );
    }
    if ((id === 'calls' || id.startsWith('report_pclients')) && c.key === 'phone') {
      const original = id === 'calls' ? data.calls?.find((row) => row.id === r.id) : undefined;
      const phone = original?.phone || members.find((m) => String(m.id) === r.memberId)?.phone;
      return phone ? (
        <Button
          variant="ghost"
          onClick={() => setCall({ name: r.name, phone })}
          aria-label={`Позвонить: ${r.name}`}
        >
          <Phone size={16} />
          {r.phone}
        </Button>
      ) : (
        '—'
      );
    }
    if (id === 'calls' && c.key === 'recording') {
      const localRecording = r.recordingUrl?.startsWith('audio/') ? r.recordingUrl : '';
      return localRecording ? (
        <audio
          controls
          preload="none"
          src={new URL(localRecording, window.location.href.split('#')[0]).href}
          aria-label={`Запись звонка ${r.time}`}
        />
      ) : (
        <span className="ws-muted">Нет записи</span>
      );
    }
    return r[c.key] === '' || r[c.key] === undefined
      ? '—'
      : c.format === 'money'
        ? money(Number(r[c.key]) / 100)
        : c.format === 'date'
          ? prettyDate(r[c.key])
          : c.format === 'percent'
            ? `${r[c.key]}%`
            : r[c.key];
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
      <section className="panel ws-panel">
        <div className="ws-panel-heading statistics-report-heading">
          <div>
            <h2>{isClientRating(id) ? 'Рейтинг клиентов' : reportTitle(report)}</h2>
          </div>
        </div>
        {isClientRating(id) && (
          <Tabs
            label="Вид рейтинга клиентов"
            value={id}
            onChange={onReport}
            items={clientRatingTabs}
          />
        )}
        {!reportPending[id] && id !== 'birdthday' && (
          <div className="ws-toolbar statistics-filters">
            {id === 'visit_by_period' && (
              <ReportMonthPicker
                month={filters.from.slice(0, 7)}
                onChange={(month) => {
                  const period = reportMonth(month);
                  if (period) setFilters((current) => ({ ...current, ...period }));
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
            {report.group === 'trainers' &&
              choice('trainer', 'Тренер', [
                { id: 'all', name: 'Все тренеры' },
                ...(data['trainer-profiles'] || []).map((t) => ({ id: t.id, name: t.name })),
              ])}
            {['clients_active', 'selltovosit', 'selling_clients_secondary'].includes(id) && (
              <>
                {flag('includePersonal', 'Включать персональные тренировки')}
                {flag('includeSingle', 'Включать разовые и гостевые')}
                {flag('includeCorporate', 'Включать корпоративные')}
                {id === 'clients_active' && flag('onlyUnlimited', 'Только безлимитные')}
              </>
            )}
            {id === 'newclients' && (
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
                {flag('groupByTrainer', 'Группировать по тренеру')}
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
            {['selling_clients_secondary', 'selling_clients_afterguest'].includes(id) &&
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
                {choice('compare', 'Сравнение', [
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
            {['clients_new', 'selling_clients_new'].includes(id) &&
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
          </div>
        )}
      </section>
      <p className="ws-muted statistics-data-note">
        Демоданные · сегодня {prettyDate(demoStamp(registrationNow()).slice(0, 10))} · московское
        время · ₽
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
                className={`panel ws-panel${id === 'gtrener_busy' ? ' statistics-week-table' : ''}`}
                key={`${id}-${index}`}
              >
                <div className="ws-panel-heading">
                  <h3>{block.title}</h3>
                </div>
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
