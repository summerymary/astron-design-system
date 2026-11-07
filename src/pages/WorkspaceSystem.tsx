import { useCallback, useMemo, useState } from 'react';
import {
  ArrowRight,
  Camera,
  Pause,
  Play,
  Plus,
  Search,
  ShieldCheck,
  VolumeX,
  X,
} from 'lucide-react';
import { Button, Modal } from '../components/ui';
import { useTheme } from '../components/ThemeProvider';
import { useWorkspace } from '../components/WorkspaceProvider';
import {
  DataTable,
  Empty,
  FieldControl,
  LinkCards,
  Notice,
  RecordDetails,
  RecordForm,
  ResourcePage,
  SearchBox,
  SectionLinks,
  Stats,
  Status,
  Tabs,
} from '../components/WorkspaceUI';
import type { Navigate } from '../components/WorkspaceUI';
import { adminSections } from '../data/admin';
import type { AdminSectionId } from '../data/admin';
import type { DemoRecord, Field, Resource } from '../data/workspace';
import { directoryGroups, resources, money, prettyDate, TODAY } from '../data/workspace';
import { roles } from '../data/roles';
import { directorySnippet, searchDirectories, searchWords } from '../lib/directory-search';

const membershipSearchFields: Field[] = [
  { key: 'name', label: 'Название' },
  { key: 'short', label: 'Условия' },
  { key: 'description', label: 'Описание' },
  { key: 'duration', label: 'Срок, дней' },
  { key: 'visitSummary', label: 'Посещения' },
  { key: 'price', label: 'Стоимость' },
  { key: 'club', label: 'Клуб' },
  { key: 'status', label: 'Статус' },
];

export function DirectoriesWorkspace({ navigate }: { navigate: Navigate }) {
  const { data } = useWorkspace();
  const [query, setQuery] = useState('');
  const [opened, setOpened] = useState<{ section: AdminSectionId; row: DemoRecord } | null>(null);
  const close = useCallback(() => setOpened(null), []);
  const fieldsFor = (id: string) =>
    id === 'memberships' ? membershipSearchFields : (resources[id]?.fields ?? []);
  const recordsFor = (id: string): DemoRecord[] =>
    id === 'memberships'
      ? data.plans.map((plan) => ({
          ...plan,
          visitSummary: plan.type === 'Безлимитный' ? 'Без ограничений' : plan.visits,
        }))
      : (data[id] ?? []);
  const index = useMemo(
    () =>
      directoryGroups.flatMap((group) =>
        group.items.map((id) => {
          const meta = adminSections.find((section) => section.id === id)!;
          const config = resources[id];
          const fields = fieldsFor(id);
          return {
            id,
            title: meta.label,
            description: [meta.caption, config?.description].filter(Boolean).join('. '),
            group: group.label,
            keywords: fields.map((field) => field.label).join(' '),
            records: recordsFor(id).map((row) => ({
              id: row.id,
              title: row.name,
              details: fields
                .filter((field) => field.key !== 'name' && field.key !== 'color' && row[field.key])
                .map((field) => `${field.label}: ${row[field.key]}`)
                .join(' · '),
            })),
          };
        }),
      ),
    [data],
  );
  const searching = searchWords(query).length > 0;
  const results = useMemo(() => searchDirectories(index, query), [index, query]);
  return (
    <div className="ws-stack">
      <section className="directory-search-panel" aria-label="Поиск в справочниках">
        <label htmlFor="directory-search">Что нужно найти?</label>
        <div className="directory-search-input">
          <Search size={24} aria-hidden="true" />
          <input
            id="directory-search"
            type="search"
            value={query}
            placeholder="Например, йога, вместимость зала или тренер"
            aria-describedby="directory-search-hint"
            aria-controls="directory-results"
            onChange={(event) => setQuery(event.target.value)}
            onInput={(event) => setQuery(event.currentTarget.value)}
          />
          {query && (
            <button
              type="button"
              className="icon-button"
              aria-label="Очистить поиск по справочникам"
              onClick={() => setQuery('')}
            >
              <X size={20} />
            </button>
          )}
        </div>
        <p id="directory-search-hint">
          Поиск по названиям разделов, описаниям и записям. Можно ввести несколько слов.
        </p>
        {!searching && (
          <div className="directory-search-examples" aria-label="Примеры поиска">
            {['Йога', 'Вместимость', 'Тренер', 'Абонементы'].map((word) => (
              <button key={word} onClick={() => setQuery(word)}>
                {word}
              </button>
            ))}
          </div>
        )}
      </section>
      <div id="directory-results" className="ws-stack">
        {searching ? (
          <>
            <p className="directory-result-count" role="status">
              Найдено разделов: {results.length} · Записей:{' '}
              {results.reduce((sum, result) => sum + result.records.length, 0)}
            </p>
            {results.map((result) => (
              <section className="panel directory-result" key={result.id}>
                <div className="directory-result-heading">
                  <div>
                    <small>{result.group}</small>
                    <h2>{result.title}</h2>
                    <p>{result.description}</p>
                  </div>
                  <Button variant="secondary" onClick={() => navigate(result.id as AdminSectionId)}>
                    Открыть раздел <ArrowRight size={16} />
                  </Button>
                </div>
                {result.records.length > 0 && (
                  <ul className="directory-record-results">
                    {result.records.map((record) => (
                      <li key={record.id}>
                        <button
                          onClick={() => {
                            const row = recordsFor(result.id).find((row) => row.id === record.id);
                            if (row) setOpened({ section: result.id as AdminSectionId, row });
                          }}
                        >
                          <span>
                            <strong>{record.title}</strong>
                            <small>
                              {directorySnippet(record.details, query) || 'Посмотреть сведения'}
                            </small>
                          </span>
                          <ArrowRight size={18} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
            {!results.length && (
              <Empty
                title="Ничего не найдено"
                text="Попробуйте другое слово или более короткий запрос."
                action={
                  <Button variant="secondary" onClick={() => setQuery('')}>
                    Сбросить поиск
                  </Button>
                }
              />
            )}
          </>
        ) : (
          directoryGroups.map((group) => (
            <section key={group.label} className="ws-directory-group">
              <h2>{group.label}</h2>
              <LinkCards ids={group.items} navigate={navigate} />
            </section>
          ))
        )}
      </div>
      {opened && (
        <RecordDetails
          title={opened.row.name}
          record={opened.row}
          fields={fieldsFor(opened.section)}
          onClose={close}
          actions={
            <Button variant="secondary" onClick={() => navigate(opened.section)}>
              Открыть раздел <ArrowRight size={16} />
            </Button>
          }
        />
      )}
    </div>
  );
}

export function PayrollWorkspace({ navigate }: { navigate: Navigate }) {
  const { data, put } = useWorkspace();
  const [tab, setTab] = useState('Рабочий день');
  const [selected, setSelected] = useState(data.shifts[0]?.id || '');
  const [form, setForm] = useState<'periods' | 'calculations' | null>(null);
  const [message, setMessage] = useState('');
  const close = useCallback(() => setForm(null), []);
  const shift = data.shifts.find((row) => row.id === selected);
  const amount = shift ? Number(shift.hours) * Number(shift.rate) : 0;
  const periodFields: Field[] = [
    { key: 'name', label: 'Название периода', required: true },
    { key: 'start', label: 'С даты', type: 'date', required: true },
    { key: 'end', label: 'По дату', type: 'date', required: true },
    { key: 'policy', label: 'Правила расчёта', options: ['Базовые правила · 1'] },
  ];
  return (
    <div className="ws-stack">
      <SectionLinks ids={['employees', 'absences']} navigate={navigate} />
      <Notice>
        Сценарий расчёта — демонстрационный, как и в источнике. Формула примера: часы × ставка.
        Налоги и фактические правила зарплаты не подключены.
      </Notice>
      {message && <Notice tone="success">{message}</Notice>}
      <section className="panel ws-panel">
        <Tabs
          items={['Рабочий день', 'Проверка', 'Начисления', 'Периоды']}
          value={tab}
          onChange={setTab}
          label="Расчёт зарплаты"
        />
        <div className="ws-panel-body ws-stack">
          {tab === 'Рабочий день' && (
            <>
              <label className="form-field">
                <span>Смена</span>
                <select value={selected} onChange={(e) => setSelected(e.target.value)}>
                  {data.shifts.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name} · {prettyDate(row.start)}
                    </option>
                  ))}
                </select>
              </label>
              {shift ? (
                <>
                  <Stats
                    items={[
                      { label: 'Часы', value: shift.hours },
                      { label: 'Ставка', value: `${money(shift.rate)} / ч` },
                      { label: 'Предварительно', value: money(amount) },
                    ]}
                  />
                  <Status>{shift.status}</Status>
                  <p>
                    {shift.club} · {prettyDate(shift.start)} — {prettyDate(shift.end)}
                  </p>
                  <h3>Оплаченные продажи за день</h3>
                  <DataTable
                    rows={data.ledger.filter((row) => row.date === shift.start.split('T')[0])}
                    columns={[
                      { key: 'name', label: 'Позиция' },
                      { key: 'amount', label: 'Сумма' },
                    ]}
                  />
                  <Button
                    disabled={shift.status !== 'Черновик'}
                    onClick={() => {
                      put('shifts', { ...shift, status: 'На проверке' });
                      setMessage('Смена отправлена на проверку в прототипе.');
                    }}
                  >
                    Отправить на проверку
                  </Button>
                </>
              ) : (
                <Empty title="Смен пока нет" />
              )}
            </>
          )}
          {tab === 'Проверка' && (
            <>
              {data.shifts
                .filter((row) => row.status === 'На проверке')
                .map((row) => (
                  <div className="ws-list-line" key={row.id}>
                    <span>
                      <strong>{row.name}</strong>
                      <small>
                        {prettyDate(row.start)} · {row.hours} ч
                      </small>
                    </span>
                    <div className="ws-actions">
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setSelected(row.id);
                          setTab('Рабочий день');
                        }}
                      >
                        Открыть день
                      </Button>
                      <Button
                        onClick={() => {
                          put('shifts', { ...row, status: 'Подтверждено' });
                          put('accruals', {
                            id: `accrual-${row.id}`,
                            name: row.name,
                            date: row.start.split('T')[0],
                            basis: 'Подтверждённая смена',
                            calculation: `${row.hours} ч × ${money(row.rate)}`,
                            amount: String(Number(row.hours) * Number(row.rate)),
                            status: 'Начислено',
                          });
                          setMessage('Смена подтверждена, демоначисление добавлено.');
                        }}
                      >
                        Подтвердить
                      </Button>
                    </div>
                  </div>
                ))}
              {!data.shifts.some((row) => row.status === 'На проверке') && (
                <Empty
                  title="Нет смен на проверке"
                  text="Отправьте рабочий день на проверку, чтобы увидеть его здесь."
                />
              )}
            </>
          )}
          {tab === 'Начисления' && (
            <DataTable
              rows={data.accruals || []}
              columns={[
                { key: 'name', label: 'Сотрудник' },
                { key: 'date', label: 'Дата' },
                { key: 'basis', label: 'Основание' },
                { key: 'calculation', label: 'Расчёт' },
                { key: 'amount', label: 'Сумма' },
              ]}
            />
          )}
          {tab === 'Периоды' && (
            <>
              <div className="ws-subheading">
                <h3>Расчётные периоды</h3>
                <Button onClick={() => setForm('periods')}>
                  <Plus size={15} />
                  Период
                </Button>
              </div>
              <DataTable
                rows={data.periods}
                columns={[
                  { key: 'name', label: 'Период' },
                  { key: 'start', label: 'С' },
                  { key: 'end', label: 'По' },
                  { key: 'status', label: 'Статус' },
                  { key: 'policy', label: 'Правила' },
                ]}
              />
              <div className="ws-subheading">
                <h3>Расчёты</h3>
                <Button variant="secondary" onClick={() => setForm('calculations')}>
                  Создать расчёт
                </Button>
              </div>
              <DataTable
                rows={data.calculations}
                columns={[
                  { key: 'name', label: 'Расчёт' },
                  { key: 'period', label: 'Период' },
                  { key: 'amount', label: 'Итого начислено' },
                  { key: 'status', label: 'Статус' },
                ]}
              />
            </>
          )}
        </div>
      </section>
      {form && (
        <RecordForm
          title={form === 'periods' ? 'Новый период' : 'Создать деморасчёт'}
          fields={
            form === 'periods'
              ? periodFields
              : [
                  { key: 'name', label: 'Название расчёта', required: true },
                  {
                    key: 'period',
                    label: 'Период',
                    options: data.periods.map((row) => row.name),
                    required: true,
                  },
                ]
          }
          onClose={close}
          onSave={(record) => {
            if (form === 'periods') put('periods', { ...record, status: 'Открыт' });
            else {
              const period = data.periods.find((row) => row.name === record.period)!;
              const total = (data.accruals || [])
                .filter((row) => row.date >= period.start && row.date <= period.end)
                .reduce((sum, row) => sum + Number(row.amount), 0);
              put('calculations', { ...record, amount: String(total), status: 'Рассчитано' });
            }
            close();
            setMessage('Запись сохранена в прототипе.');
          }}
        />
      )}
    </div>
  );
}

const rights = [
  'Просматривать клиентов',
  'Изменять клиентов',
  'Регистрировать посещения',
  'Продавать услуги',
  'Работать с расписанием',
  'Просматривать отчёты',
  'Управлять персоналом',
  'Менять настройки',
  'Записывать персональные тренировки',
  'Вести заметки о своих клиентах',
  'Работать в баре',
];
const defaultRights: Record<string, string[]> = {
  administrator: rights.slice(0, 5),
  trainer: [
    'Работать с расписанием',
    'Записывать персональные тренировки',
    'Вести заметки о своих клиентах',
  ],
  bartender: ['Работать в баре'],
  'club-director': rights.slice(0, 7),
  'network-director': [...rights],
  'fitness-director': rights.slice(0, 8),
  'operations-director': rights.slice(0, 8),
  sysadmin: rights.slice(0, 8),
  marketer: ['Просматривать отчёты'],
};
export function RolesWorkspace() {
  const { data, put } = useWorkspace();
  const [role, setRole] = useState(roles[0].id);
  const [message, setMessage] = useState('');
  const selected = roles.find((value) => value.id === role)!;
  const stored = data.permissions?.find((row) => row.id === role);
  const values = stored ? stored.rights.split('|') : defaultRights[role];
  return (
    <div className="ws-stack">
      <Notice>
        Это пример матрицы для обсуждения. Переключатель ролей прототипа и доступ к реальным
        системам здесь не меняются.
      </Notice>
      {message && <Notice tone="success">{message}</Notice>}
      <section className="panel ws-panel">
        <div className="ws-split">
          <div className="ws-master-list">
            {roles.map((value) => (
              <button
                key={value.id}
                className={value.id === role ? 'selected' : ''}
                onClick={() => {
                  setRole(value.id);
                  setMessage('');
                }}
              >
                <strong>{value.label}</strong>
                <small>{value.scope === 'network' ? 'Сеть клубов' : 'Свой клуб'}</small>
              </button>
            ))}
          </div>
          <div className="ws-detail">
            <h2>{selected.label}</h2>
            <p>Базовые возможности роли</p>
            {rights.map((right) => (
              <label className="ws-permission" key={right}>
                <input
                  type="checkbox"
                  checked={values.includes(right)}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? [...values, right]
                      : values.filter((value) => value !== right);
                    put('permissions', { id: role, name: selected.label, rights: next.join('|') });
                    setMessage('Изменена только демонстрационная матрица.');
                  }}
                />
                <span>{right}</span>
                <ShieldCheck size={15} />
              </label>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

export function SecurityWorkspace({ navigate }: { navigate: Navigate }) {
  const { data } = useWorkspace();
  const [tab, setTab] = useState('На контроле');
  const config: Resource =
    tab === 'Правила доступа'
      ? {
          title: 'Контекстные политики',
          singular: 'Политика',
          description: 'Ограничивают уже выданные права по клубу и времени. Новых прав не дают.',
          fields: [
            { key: 'name', label: 'Название', required: true },
            { key: 'description', label: 'Описание', type: 'textarea' },
            { key: 'roles', label: 'Роль', options: roles.map((role) => role.label) },
            {
              key: 'club',
              label: 'Область',
              options: ['Все клубы', 'Центральный', 'Парк', 'Речной'],
            },
            { key: 'time', label: 'Время действия', hint: 'Описание правила для демонстрации' },
            { key: 'status', label: 'Статус', options: ['Активна', 'В архиве'] },
          ],
          columns: ['name', 'roles', 'club', 'time', 'status'],
          rows: [],
        }
      : tab === 'Группы доступа'
        ? {
            title: 'Группы доступа',
            singular: 'Группа доступа',
            description: 'Объединяют сотрудников и роли для общих правил.',
            fields: [
              { key: 'name', label: 'Название', required: true },
              { key: 'description', label: 'Описание', type: 'textarea' },
              { key: 'roles', label: 'Роль', options: roles.map((role) => role.label) },
              { key: 'users', label: 'Сотрудник', options: data.employees.map((row) => row.name) },
              { key: 'status', label: 'Статус', options: ['Активна', 'В архиве'] },
            ],
            columns: ['name', 'roles', 'users', 'status'],
            rows: [],
          }
        : {
            title: 'Дела расследований',
            singular: 'Дело',
            description:
              'Вымышленные примеры для проверки процесса. Реальных событий и решений здесь нет.',
            fields: [
              { key: 'name', label: 'Название дела', required: true },
              { key: 'description', label: 'Подтверждённые факты', type: 'textarea' },
              {
                key: 'owner',
                label: 'Ответственный',
                options: data.employees.map((row) => row.name),
              },
              { key: 'priority', label: 'Приоритет', options: ['Обычный', 'Высокий'] },
              { key: 'status', label: 'Статус', options: ['Новое', 'В работе', 'Завершено'] },
            ],
            columns: ['name', 'owner', 'priority', 'status'],
            rows: [],
          };
  return (
    <div className="ws-stack">
      <SectionLinks ids={['rbac', 'event-logs']} navigate={navigate} />
      <Stats
        items={[
          {
            label: 'Нужно проверить',
            value: data.cases.filter((row) => row.status === 'Новое').length,
          },
          {
            label: 'В работе',
            value: data.cases.filter((row) => row.status === 'В работе').length,
          },
          { label: 'Дела', value: data.cases.length },
        ]}
      />
      <Tabs
        items={['На контроле', 'Правила доступа', 'Группы доступа']}
        value={tab}
        onChange={setTab}
        label="Безопасность"
      />
      {tab === 'Правила доступа' && (
        <Notice>
          Доступ складывается из входа сотрудника, прав роли и ограничений рабочего контекста. Здесь
          правила только показываются и не защищают приложение.
        </Notice>
      )}
      <ResourcePage
        key={tab}
        collection={
          tab === 'Правила доступа'
            ? 'policies'
            : tab === 'Группы доступа'
              ? 'access-groups'
              : 'cases'
        }
        config={config}
        navigate={navigate}
      />
    </div>
  );
}

export function EventLogsWorkspace() {
  const { data } = useWorkspace();
  const [type, setType] = useState('Все');
  const [query, setQuery] = useState('');
  const [service, setService] = useState('Все разделы');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [opened, setOpened] = useState<DemoRecord | null>(null);
  const close = useCallback(() => setOpened(null), []);
  const rows = data.logs.filter(
    (row) =>
      (type === 'Все' || row.type === type) &&
      (service === 'Все разделы' || row.service === service) &&
      (!from || row.date >= from) &&
      (!to || row.date.slice(0, 10) <= to) &&
      `${row.name} ${row.user} ${row.request}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <section className="panel ws-panel">
      <div className="ws-panel-heading">
        <div>
          <h2>История событий</h2>
          <p>В примерах нет контактов, паролей и технических секретов.</p>
        </div>
      </div>
      <Tabs
        items={['Все', 'Действия', 'Аудит', 'Система']}
        value={type}
        onChange={setType}
        label="Тип журнала"
      />
      <div className="ws-toolbar">
        <SearchBox
          value={query}
          onChange={setQuery}
          placeholder="Событие, сотрудник или номер запроса"
        />
        <select
          aria-label="Раздел журнала"
          value={service}
          onChange={(e) => setService(e.target.value)}
        >
          <option>Все разделы</option>
          {[...new Set(data.logs.map((row) => row.service))].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
        <label className="form-field">
          <span>С даты</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="form-field">
          <span>По дату</span>
          <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
        </label>
        <Button
          variant="ghost"
          onClick={() => {
            setType('Все');
            setQuery('');
            setService('Все разделы');
            setFrom('');
            setTo('');
          }}
        >
          Сбросить
        </Button>
      </div>
      <DataTable
        rows={rows}
        columns={[
          { key: 'date', label: 'Время' },
          { key: 'name', label: 'Событие' },
          { key: 'service', label: 'Раздел' },
          { key: 'user', label: 'Сотрудник' },
          { key: 'request', label: 'Запрос' },
        ]}
        onOpen={setOpened}
      />
      {opened && (
        <RecordDetails
          title={opened.name}
          record={opened}
          fields={[
            { key: 'date', label: 'Время' },
            { key: 'user', label: 'Сотрудник' },
            { key: 'type', label: 'Тип' },
            { key: 'status', label: 'Результат' },
            { key: 'request', label: 'Номер запроса' },
            { key: 'description', label: 'Подробности' },
          ]}
          onClose={close}
        />
      )}
    </section>
  );
}

export function CamerasWorkspace() {
  const [zone, setZone] = useState('Все зоны');
  const [opened, setOpened] = useState<string | null>(null);
  const [mode, setMode] = useState('Прямой просмотр');
  const [playing, setPlaying] = useState(false);
  const [date, setDate] = useState(TODAY);
  const cameras = ['Ресепшен', 'Тренажёрный зал', 'Вход'];
  const close = useCallback(() => {
    setOpened(null);
    setPlaying(false);
  }, []);
  return (
    <div className="ws-stack">
      <Notice>
        Здесь схемы камер, без реального видео и записи людей. Подключение камер не выполняется.
      </Notice>
      <div className="ws-toolbar">
        <select aria-label="Зона камер" value={zone} onChange={(e) => setZone(e.target.value)}>
          <option>Все зоны</option>
          {cameras.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
        <span className="ws-muted">Превью запускается по запросу · звук выключен</span>
      </div>
      <div className="ws-camera-grid">
        {cameras
          .filter((value) => zone === 'Все зоны' || value === zone)
          .map((name) => (
            <button
              className="panel ws-camera-card"
              key={name}
              onClick={() => {
                setOpened(name);
                setMode('Прямой просмотр');
              }}
            >
              <div className="ws-camera-placeholder">
                <Camera size={32} />
                <span>Демонстрация</span>
              </div>
              <div>
                <strong>{name}</strong>
                <span>
                  Открыть
                  <ArrowRight size={14} />
                </span>
              </div>
            </button>
          ))}
      </div>
      {opened && (
        <Modal title={opened} subtitle="Демонстрационный просмотр камеры" onClose={close}>
          <div className="ws-stack">
            <Tabs
              items={['Прямой просмотр', 'Архив']}
              value={mode}
              onChange={(value) => {
                setMode(value);
                setPlaying(false);
              }}
              label="Режим камеры"
            />
            {mode === 'Архив' && (
              <label className="form-field">
                <span>Дата записи</span>
                <input
                  type="date"
                  max={TODAY}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </label>
            )}
            <div className={`ws-camera-placeholder ws-camera-large ${playing ? 'is-playing' : ''}`}>
              <Camera size={50} />
              <span>{playing ? 'Пример состояния просмотра' : 'Просмотр остановлен'}</span>
            </div>
            <div className="ws-actions">
              <Button onClick={() => setPlaying(!playing)}>
                {playing ? <Pause size={15} /> : <Play size={15} />}
                {playing ? 'Остановить' : 'Показать демосостояние'}
              </Button>
              <span className="ws-muted">
                <VolumeX size={15} />
                Без звука
              </span>
            </div>
            <small className="ws-muted">
              Архив и управление просмотром — предложение дизайна: на источнике изучен список камер,
              реальные потоки и записи не переносились.
            </small>
          </div>
        </Modal>
      )}
    </div>
  );
}

export function PreferencesWorkspace({ section, name }: { section: AdminSectionId; name: string }) {
  const { data, put } = useWorkspace();
  const { palette, setPrimary } = useTheme();
  const [tab, setTab] = useState('Основные');
  const [primary, setPrimaryDraft] = useState(palette.primary);
  const [message, setMessage] = useState('');
  const [profile, setProfile] = useState(() => {
    const stored = data.preferences?.find((row) => row.id === 'profile');
    return {
      name: stored?.name ?? name,
      email: stored?.email ?? 'admin@example.com',
      application: stored ? stored.application === 'true' : true,
      sound: stored?.sound === 'true',
      browser: stored?.browser === 'true',
    };
  });
  const calendar = data.preferences?.find((row) => row.id === 'calendar') || {
    id: 'calendar',
    name: 'Центральный',
    timezone: 'Europe/Moscow',
    boundary: '03:00',
  };
  const [calendarDraft, setCalendar] = useState(calendar);
  const settings = data.preferences?.find((row) => row.id === 'schedule') || {
    id: 'schedule',
    view: 'Неделя',
    weekends: 'Показывать',
    group: 'По залам',
    step: '30',
  };
  const [schedule, setSchedule] = useState(settings);
  if (section === 'schedule-calendar')
    return (
      <section className="panel ws-panel">
        <div className="ws-panel-heading">
          <div>
            <h2>Календарь клуба</h2>
            <p>Часовой пояс и начало рабочего дня задаются для выбранного клуба.</p>
          </div>
        </div>
        <form
          className="ws-panel-body ws-stack"
          onSubmit={(event) => {
            event.preventDefault();
            put('preferences', calendarDraft);
            setMessage('Параметры сохранены в памяти прототипа.');
          }}
        >
          {[
            { key: 'name', label: 'Клуб', options: ['Центральный', 'Парк', 'Речной'] },
            { key: 'timezone', label: 'Часовой пояс', options: ['Europe/Moscow'] },
            {
              key: 'boundary',
              label: 'Начало рабочего дня',
              hint: 'Демонстрационное значение. Правила границы дня требуют подтверждения.',
            },
          ].map((field) => (
            <FieldControl
              key={field.key}
              field={field}
              value={calendarDraft[field.key]}
              onChange={(value) => setCalendar({ ...calendarDraft, [field.key]: value })}
            />
          ))}
          <Button type="submit">Сохранить</Button>
          {message && <Notice tone="success">{message}</Notice>}
        </form>
      </section>
    );
  if (section === 'settings')
    return (
      <div className="ws-two-column">
        <section className="panel ws-panel">
          <div className="ws-panel-heading">
            <h2>Профиль и уведомления</h2>
          </div>
          <form
            className="ws-panel-body ws-stack"
            onSubmit={(event) => {
              event.preventDefault();
              put('preferences', {
                id: 'profile',
                name: profile.name,
                email: profile.email,
                application: String(profile.application),
                sound: String(profile.sound),
                browser: String(profile.browser),
              });
              setMessage(
                'Личные настройки сохранены в прототипе. Разрешения браузера не запрашивались.',
              );
            }}
          >
            <FieldControl
              field={{ key: 'name', label: 'Имя сотрудника', required: true }}
              value={profile.name}
              onChange={(value) => setProfile({ ...profile, name: value })}
            />
            <FieldControl
              field={{ key: 'email', label: 'Email', type: 'email' }}
              value={profile.email}
              onChange={(value) => setProfile({ ...profile, email: value })}
            />
            {(
              [
                { key: 'application', label: 'Уведомления в приложении' },
                { key: 'sound', label: 'Звуковые уведомления' },
                { key: 'browser', label: 'Уведомления браузера — демонастройка' },
              ] as const
            ).map((item) => (
              <label className="ws-checkbox" key={item.key}>
                <input
                  type="checkbox"
                  checked={profile[item.key]}
                  onChange={(e) => setProfile({ ...profile, [item.key]: e.target.checked })}
                />
                {item.label}
              </label>
            ))}
            <Button type="submit">Сохранить настройки</Button>
            {message && <Notice>{message}</Notice>}
          </form>
        </section>
        <section className="panel ws-panel">
          <div className="ws-panel-heading">
            <h2>PIN сотрудника</h2>
          </div>
          <form
            className="ws-panel-body ws-stack"
            onSubmit={(event) => {
              event.preventDefault();
              const values = new FormData(event.currentTarget);
              if (values.get('newPin') !== values.get('confirmPin')) {
                setMessage('Новый PIN и подтверждение не совпадают.');
                return;
              }
              event.currentTarget.reset();
              setMessage(
                'Демонстрация завершена. PIN не сохранён; реальная учётная запись не менялась.',
              );
            }}
          >
            <p className="ws-muted">
              Пример формы, без проверки и хранения кодов. Используйте только выдуманные цифры.
            </p>
            {[
              { key: 'oldPin', label: 'Текущий демо-PIN' },
              { key: 'newPin', label: 'Новый демо-PIN' },
              { key: 'confirmPin', label: 'Повторите демо-PIN' },
            ].map((item) => (
              <label className="form-field" key={item.key}>
                <span>{item.label}</span>
                <input
                  name={item.key}
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]{4,6}"
                  minLength={4}
                  maxLength={6}
                  required
                  autoComplete="off"
                />
              </label>
            ))}
            <Button type="submit" variant="secondary">
              Проверить форму
            </Button>
          </form>
        </section>
      </div>
    );
  const tabs = ['Основные', 'Клубы', 'Расписание', 'Абонементы', 'Персонал', 'Журналы'];
  return (
    <div className="ws-stack">
      <section className="panel ws-panel">
        <Tabs
          items={tabs}
          value={tab}
          onChange={(value) => {
            setTab(value);
            setMessage('');
          }}
          label="Настройки системы"
        />
        <div className="ws-panel-body ws-stack">
          {tab === 'Основные' ? (
            <>
              <h2>Оформление клуба</h2>
              <p className="ws-muted">
                Палитра автоматически подстраивается под основной цвет. Значения статусов
                сохраняются.
              </p>
              <FieldControl
                field={{ key: 'organization', label: 'Название организации' }}
                value={data.preferences?.find((row) => row.id === 'organization')?.name || 'Астрон'}
                onChange={(value) => put('preferences', { id: 'organization', name: value })}
              />
              <div className="ws-brand-color">
                <input
                  type="color"
                  aria-label="Основной цвет клуба"
                  value={/^#[\da-f]{6}$/i.test(primary) ? primary : palette.primary}
                  onChange={(e) => setPrimaryDraft(e.target.value)}
                />
                <label className="form-field">
                  <span>Основной цвет, HEX</span>
                  <input
                    value={primary}
                    maxLength={7}
                    onChange={(e) => setPrimaryDraft(e.target.value)}
                  />
                </label>
              </div>
              <div className="ws-actions">
                <Button
                  disabled={!/^#[\da-f]{6}$/i.test(primary)}
                  onClick={() => {
                    setPrimary(primary);
                    setMessage('Цвет применён к прототипу.');
                  }}
                >
                  Применить цвет
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setPrimaryDraft('#8A332C');
                    setPrimary('#8A332C');
                    setMessage('Восстановлен тёплый бордовый «Астрона».');
                  }}
                >
                  Цвет Астрона
                </Button>
              </div>
              <div className="ws-brand-preview">
                <strong>Пример оформления</strong>
                <Button>Основное действие</Button>
                <Status>Активен</Status>
                <p>Вторичный текст и статус остаются читаемыми.</p>
              </div>
              <Notice>
                Правила логотипа, фоновые цвета и полная палитра описаны в отдельной дизайн-системе.
                Общий логотип клуба задаётся в настройках бренда проекта.
              </Notice>
            </>
          ) : tab === 'Расписание' ? (
            <>
              <h2>Вид расписания по умолчанию</h2>
              {[
                { key: 'view', label: 'Вид', options: ['Неделя', 'День', 'Список'] },
                { key: 'weekends', label: 'Выходные', options: ['Показывать', 'Скрывать'] },
                { key: 'group', label: 'Группировка', options: ['По залам', 'По тренерам'] },
                { key: 'step', label: 'Шаг сетки, минут', options: ['15', '30', '60'] },
              ].map((field) => (
                <FieldControl
                  key={field.key}
                  field={field}
                  value={schedule[field.key]}
                  onChange={(value) => setSchedule({ ...schedule, [field.key]: value })}
                />
              ))}
              <Button
                onClick={() => {
                  put('preferences', schedule);
                  setMessage(
                    'Предпочтения сохранены. В прототипе сетка занятий адаптируется к ширине экрана.',
                  );
                }}
              >
                Сохранить
              </Button>
            </>
          ) : (
            <Empty
              title="Доступных параметров пока нет"
              text="В текущей версии источника настройки этого раздела не опубликованы. Они будут разработаны после уточнения требований."
            />
          )}
          {message && <Notice tone="success">{message}</Notice>}
        </div>
      </section>
    </div>
  );
}
