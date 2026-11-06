import { useCallback, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  CupSoda,
  Plus,
} from 'lucide-react';
import { Button, Modal } from '../components/ui';
import { ClientSearch } from '../components/ClientSearch';
import { demoId, useWorkspace } from '../components/WorkspaceProvider';
import {
  Back,
  DataTable,
  Empty,
  FieldControl,
  Notice,
  RecordDetails,
  RecordForm,
  SearchBox,
  SectionLinks,
  Stats,
  Status,
  Tabs,
} from '../components/WorkspaceUI';
import type { Navigate } from '../components/WorkspaceUI';
import type { DemoRecord, Field } from '../data/workspace';
import { money, prettyDate, TODAY } from '../data/workspace';
import { visitKinds } from '../data/admin';
import type { Member, VisitKind } from '../types';
import { inventoryStock, validatePlan } from '../lib/workspace-rules';

const clubField: Field = {
  key: 'club',
  label: 'Клуб',
  options: ['Центральный', 'Парк', 'Речной'],
  required: true,
};
const datePlus = (date: string, days: number) => {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};
const dayLabel = (date: string, short = false) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString('ru-RU', {
    timeZone: 'Europe/Moscow',
    weekday: short ? 'short' : 'long',
    day: 'numeric',
    month: 'short',
  });
export function ScheduleWorkspace({
  members,
  navigate,
  clubName,
}: {
  members: Member[];
  navigate: Navigate;
  clubName: string;
}) {
  const { data, put } = useWorkspace();
  const [week, setWeek] = useState('2026-11-02');
  const [day, setDay] = useState(TODAY);
  const preferences = data.preferences?.find((row) => row.id === 'schedule');
  const [view, setView] = useState(preferences?.view || 'Неделя');
  const [club, setClub] = useState(clubName.split(' · ').at(-1) || 'Центральный');
  const [trainer, setTrainer] = useState('Все тренеры');
  const [opened, setOpened] = useState<DemoRecord | null>(null);
  const [editing, setEditing] = useState<DemoRecord | 'new' | null>(null);
  const [copying, setCopying] = useState(false);
  const [booking, setBooking] = useState('');
  const [message, setMessage] = useState('');
  const close = useCallback(() => {
    setOpened(null);
    setBooking('');
  }, []);
  const closeForm = useCallback(() => setEditing(null), []);
  const closeCopy = useCallback(() => setCopying(false), []);
  const dates = Array.from({ length: preferences?.weekends === 'Скрывать' ? 5 : 7 }, (_, index) =>
    datePlus(week, index),
  );
  const events = data.events
    .filter(
      (row) =>
        row.club === club &&
        (trainer === 'Все тренеры' || row.trainer === trainer) &&
        dates.includes(row.day),
    )
    .sort((a, b) => `${a.day}${a.time}`.localeCompare(`${b.day}${b.time}`));
  const fields: Field[] = [
    {
      key: 'name',
      label: 'Занятие',
      options: data['training-templates']
        .filter((row) => row.status === 'Активен')
        .map((row) => row.name),
      required: true,
    },
    clubField,
    { key: 'day', label: 'Дата', type: 'date', required: true },
    { key: 'time', label: 'Начало, ЧЧ:ММ', required: true, hint: 'Например, 18:00' },
    { key: 'duration', label: 'Длительность, мин', type: 'number', min: 5, required: true },
    { key: 'trainer', label: 'Тренер', options: ['Алина Белова', 'Максим Ветров'], required: true },
    {
      key: 'room',
      label: 'Зал',
      options: [...new Set(data.rooms.map((row) => row.name))],
      required: true,
    },
    { key: 'capacity', label: 'Количество мест', type: 'number', min: 1, required: true },
  ];
  const showEvent = (event: DemoRecord) => {
    setOpened(event);
    setMessage('');
  };
  const tile = (event: DemoRecord) => (
    <button
      key={event.id}
      className={`ws-event ${event.status === 'Отменено' ? 'is-cancelled' : ''}`}
      style={{ borderLeftColor: event.color || 'var(--color-accent)' }}
      onClick={() => showEvent(event)}
    >
      <b>
        {event.time}
        <span>{event.duration} мин</span>
      </b>
      <strong>{event.name}</strong>
      <small>{event.trainer}</small>
      <small>
        {event.room} · {event.booked} / {event.capacity}
      </small>
      {event.status === 'Отменено' && <Status>Отменено</Status>}
    </button>
  );
  return (
    <div className="ws-stack">
      <SectionLinks
        ids={['training-templates', 'training-groups', 'schedule-calendar']}
        navigate={navigate}
      />
      {message && <Notice tone="success">{message}</Notice>}
      <section className="panel ws-panel">
        <div className="ws-panel-heading">
          <div>
            <h2>Расписание занятий</h2>
            <p>
              {dayLabel(week)} — {dayLabel(datePlus(week, 6))}
            </p>
          </div>
          <Button onClick={() => setEditing('new')}>
            <Plus size={15} />
            Занятие
          </Button>
        </div>
        <div className="ws-toolbar">
          <div className="ws-actions">
            <button
              className="icon-button"
              aria-label="Предыдущая неделя"
              onClick={() => {
                setWeek(datePlus(week, -7));
                setDay(datePlus(day, -7));
              }}
            >
              <ChevronLeft size={18} />
            </button>
            <Button
              variant="secondary"
              onClick={() => {
                setWeek('2026-11-02');
                setDay(TODAY);
              }}
            >
              Сегодня
            </Button>
            <button
              className="icon-button"
              aria-label="Следующая неделя"
              onClick={() => {
                setWeek(datePlus(week, 7));
                setDay(datePlus(day, 7));
              }}
            >
              <ChevronRight size={18} />
            </button>
          </div>
          <select
            aria-label="Клуб расписания"
            value={club}
            onChange={(e) => setClub(e.target.value)}
          >
            {['Центральный', 'Парк', 'Речной'].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
          <select
            aria-label="Тренер расписания"
            value={trainer}
            onChange={(e) => setTrainer(e.target.value)}
          >
            <option>Все тренеры</option>
            <option>Алина Белова</option>
            <option>Максим Ветров</option>
          </select>
          <Button variant="ghost" onClick={() => setCopying(true)}>
            <Copy size={14} />
            Из прошлой недели
          </Button>
        </div>
        <Tabs
          items={['Неделя', 'День', 'Список']}
          value={view}
          onChange={setView}
          label="Вид расписания"
        />
        {view === 'Неделя' ? (
          <div className="ws-week">
            {dates.map((date) => (
              <div className="ws-week-day" key={date}>
                <button
                  className={date === TODAY ? 'is-today' : ''}
                  onClick={() => {
                    setDay(date);
                    setView('День');
                  }}
                >
                  {dayLabel(date, true)}
                  {date === TODAY && <small>Сегодня</small>}
                </button>
                <div>
                  {events.filter((row) => row.day === date).map(tile)}
                  {!events.some((row) => row.day === date) && (
                    <span className="ws-week-empty">Нет занятий</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : view === 'День' ? (
          <>
            <div className="ws-day-picker">
              {dates.map((date) => (
                <button
                  className={date === day ? 'selected' : ''}
                  key={date}
                  onClick={() => setDay(date)}
                >
                  {dayLabel(date, true)}
                </button>
              ))}
            </div>
            <div className="ws-event-list">
              {events.filter((row) => row.day === day).map(tile)}
              {!events.some((row) => row.day === day) && (
                <Empty
                  title="Занятий в этот день нет"
                  text="Выберите другой день или добавьте занятие."
                />
              )}
            </div>
          </>
        ) : (
          <DataTable
            rows={events}
            columns={[
              { key: 'day', label: 'Дата' },
              { key: 'time', label: 'Начало' },
              { key: 'name', label: 'Занятие' },
              { key: 'trainer', label: 'Тренер' },
              { key: 'room', label: 'Зал' },
              { key: 'booked', label: 'Записано' },
              { key: 'capacity', label: 'Мест' },
            ]}
            onOpen={showEvent}
          />
        )}
      </section>
      {opened && (
        <Modal
          title={opened.name}
          subtitle={`${prettyDate(opened.day)} · ${opened.time} · ${opened.room}`}
          onClose={close}
        >
          <div className="ws-stack">
            <Stats
              items={[
                { label: 'Длительность', value: `${opened.duration} мин` },
                { label: 'Участники', value: `${opened.booked} / ${opened.capacity}` },
              ]}
            />
            <p>
              Тренер: <strong>{opened.trainer}</strong>
            </p>
            <Status>{opened.status}</Status>
            {opened.status !== 'Отменено' && opened.status !== 'Завершено' && (
              <>
                <label className="form-field">
                  <span>Клиент для записи</span>
                  <select value={booking} onChange={(e) => setBooking(e.target.value)}>
                    <option value="">Выберите клиента</option>
                    {members.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name}
                      </option>
                    ))}
                  </select>
                </label>
                <Button
                  disabled={
                    !booking ||
                    (opened.attendees ?? '').split(',').includes(booking) ||
                    Number(opened.booked) >= Number(opened.capacity)
                  }
                  onClick={() => {
                    const next = {
                      ...opened,
                      booked: String(Number(opened.booked) + 1),
                      attendees: [opened.attendees, booking].filter(Boolean).join(','),
                    };
                    put('events', next);
                    setOpened(next);
                    setBooking('');
                    setMessage('Клиент записан на занятие.');
                  }}
                >
                  <Check size={15} />
                  Записать клиента
                </Button>
                {Number(opened.booked) >= Number(opened.capacity) && (
                  <Notice tone="warning">
                    Свободных мест нет. В источнике доступны настройки листа ожидания; правила его
                    работы требуют уточнения.
                  </Notice>
                )}
                {opened.attendees && (
                  <div>
                    <h3>Записи в прототипе</h3>
                    {opened.attendees
                      .split(',')
                      .filter(Boolean)
                      .map((id) => (
                        <div className="ws-list-line" key={id}>
                          <span>{members.find((member) => String(member.id) === id)?.name}</span>
                          <Button
                            variant="ghost"
                            onClick={() => {
                              const next = {
                                ...opened,
                                booked: String(Math.max(0, Number(opened.booked) - 1)),
                                attendees: opened.attendees
                                  .split(',')
                                  .filter((value) => value !== id)
                                  .join(','),
                              };
                              put('events', next);
                              setOpened(next);
                            }}
                          >
                            Снять запись
                          </Button>
                        </div>
                      ))}
                  </div>
                )}
                <Button
                  variant="secondary"
                  onClick={() => {
                    setEditing(opened);
                    close();
                  }}
                >
                  Редактировать занятие
                </Button>
                <details className="ws-disclosure">
                  <summary>Другие действия</summary>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      const next = { ...opened, status: 'Отменено' };
                      put('events', next);
                      setOpened(next);
                    }}
                  >
                    Отменить это демозанятие
                  </Button>
                </details>
              </>
            )}
          </div>
        </Modal>
      )}
      {editing && (
        <RecordForm
          title={editing === 'new' ? 'Новое занятие' : 'Изменить занятие'}
          fields={fields}
          initial={
            editing === 'new'
              ? {
                  id: demoId('event'),
                  name: data['training-templates'][0]?.name ?? '',
                  day,
                  time: '18:00',
                  duration: '55',
                  trainer: 'Алина Белова',
                  room: data.rooms.find((row) => row.club === club)?.name ?? '',
                  club,
                  capacity: '20',
                  booked: '0',
                  status: 'Запись открыта',
                  color: '#8A332C',
                }
              : editing
          }
          onClose={closeForm}
          onSave={(record) => {
            if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(record.time)) {
              return 'Время должно быть в формате ЧЧ:ММ, например 18:00.';
            }
            if (Number(record.capacity) < Number(record.booked || 0)) {
              return 'Количество мест не может быть меньше числа записанных.';
            }
            if (!data.rooms.some((row) => row.name === record.room && row.club === record.club))
              return 'Выбранный зал находится в другом клубе.';
            put('events', record);
            closeForm();
            setMessage('Занятие сохранено.');
          }}
        />
      )}
      {copying && (
        <Modal
          title="Скопировать предыдущую неделю?"
          subtitle="Будут добавлены только занятия выбранного клуба. Существующие занятия сохранятся."
          onClose={closeCopy}
        >
          <p>
            Источник: {prettyDate(datePlus(week, -7))} — {prettyDate(datePlus(week, -1))}
          </p>
          <p>Клуб: {club}</p>
          <div className="modal-actions">
            <Button variant="secondary" onClick={closeCopy}>
              Отмена
            </Button>
            <Button
              onClick={() => {
                let count = 0;
                data.events
                  .filter(
                    (row) =>
                      row.club === club &&
                      row.day >= datePlus(week, -7) &&
                      row.day < week &&
                      row.status !== 'Отменено',
                  )
                  .forEach((row) => {
                    const date = datePlus(row.day, 7);
                    if (
                      !data.events.some(
                        (existing) =>
                          existing.day === date &&
                          existing.time === row.time &&
                          existing.room === row.room &&
                          existing.club === club,
                      )
                    ) {
                      put('events', {
                        ...row,
                        id: demoId('event'),
                        day: date,
                        booked: '0',
                        attendees: '',
                        status: 'Запись открыта',
                      });
                      count++;
                    }
                  });
                closeCopy();
                setMessage(
                  count
                    ? `Добавлено занятий: ${count}. Записи клиентов не копировались.`
                    : 'Нет новых занятий для копирования.',
                );
              }}
            >
              Скопировать
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

const planSteps = [
  'Основное',
  'Срок и визиты',
  'Доступ',
  'Продажа',
  'Онлайн-витрина',
  'Бонусы',
  'Дополнительно',
];
const planFields: Field[][] = [
  [
    { key: 'name', label: 'Название карты', required: true },
    {
      key: 'type',
      label: 'Тип абонемента',
      options: ['Безлимитный', 'По посещениям', 'Разовое посещение'],
    },
    { key: 'short', label: 'Короткое описание' },
    { key: 'description', label: 'Описание для клиента', type: 'textarea' },
  ],
  [
    { key: 'duration', label: 'Срок действия, дней', type: 'number', min: 1, required: true },
    {
      key: 'visits',
      label: 'Количество посещений',
      type: 'number',
      min: 0,
      hint: 'Для безлимитного абонемента количество не ограничено.',
    },
    {
      key: 'activation',
      label: 'Начало действия',
      options: ['С первого посещения', 'С даты покупки'],
    },
    {
      key: 'hours',
      label: 'Часы посещения',
      type: 'textarea',
      hint: 'Информация для клиента. Эти часы сами по себе не ограничивают проход.',
    },
  ],
  [
    { key: 'club', label: 'Клубы', options: ['Все клубы', 'Центральный', 'Парк', 'Речной'] },
    {
      key: 'direction',
      label: 'Направление',
      options: ['Все направления', 'Сила', 'Баланс', 'Кардио'],
    },
    {
      key: 'training',
      label: 'Тип тренировок',
      options: ['Групповые и тренажёрный зал', 'Групповые', 'Персональные', 'Тренажёрный зал'],
    },
    { key: 'age', label: 'Возрастные условия' },
    { key: 'gender', label: 'Пол', options: ['Любой', 'Женский', 'Мужской'] },
    { key: 'mode', label: 'Посещение', options: ['Офлайн', 'Онлайн', 'Онлайн и офлайн'] },
    { key: 'freezeEnabled', label: 'Заморозка', options: ['Нет', 'Да'] },
    { key: 'freeze', label: 'Условия заморозки', type: 'textarea' },
  ],
  [
    { key: 'price', label: 'Цена, ₽', type: 'number', min: 0, required: true },
    { key: 'discount', label: 'Онлайн-скидка, %', type: 'number', min: 0 },
    { key: 'online', label: 'Покупка онлайн', options: ['Доступен', 'Недоступен'] },
  ],
  [
    { key: 'storefront', label: 'Категория витрины', options: ['Клубные карты', 'Тренировки'] },
    { key: 'color', label: 'Цвет карточки', type: 'color' },
    { key: 'onlineTraining', label: 'Онлайн-тренировки', options: ['Нет', 'Да'] },
  ],
  [],
  [
    { key: 'spa', label: 'Доступ в SPA', options: ['Нет', 'Да'] },
    { key: 'secondHolder', label: 'Второй владелец', options: ['Нет', 'Да'] },
  ],
];
export function MembershipWorkspace({ navigate }: { navigate: Navigate }) {
  const { data, put } = useWorkspace();
  const [category, setCategory] = useState<string | null>(null);
  const [draft, setDraft] = useState<DemoRecord | null>(null);
  const [step, setStep] = useState(planSteps[0]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('Все');
  const [categoryForm, setCategoryForm] = useState<DemoRecord | 'new' | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const closeCategory = useCallback(() => setCategoryForm(null), []);
  const selected = data.categories.find((row) => row.id === category);
  const savePlan = (publish: boolean) => {
    if (!draft) return;
    const invalid = validatePlan(draft, publish);
    if (invalid) {
      setStep(invalid.step);
      setError(invalid.message);
      return;
    }
    put('plans', { ...draft, currency: 'RUB', status: publish ? 'Опубликован' : 'Черновик' });
    setDraft(null);
    setError('');
    setMessage(publish ? 'Абонемент опубликован в демокаталоге.' : 'Черновик сохранён.');
  };
  if (draft)
    return (
      <div className="ws-stack">
        <Back
          onClick={() => {
            setDraft(null);
            setError('');
          }}
        >
          К абонементам
        </Back>
        <div className="ws-builder">
          <section className="panel ws-panel">
            <div className="ws-panel-heading">
              <div>
                <h2>{draft.name || 'Новый абонемент'}</h2>
                <p>Настройте условия и проверьте карточку справа.</p>
              </div>
              <Status>{draft.status || 'Черновик'}</Status>
            </div>
            <Tabs items={planSteps} value={step} onChange={setStep} label="Настройка абонемента" />
            <div className="ws-panel-body">
              <div className="ws-fields">
                {planFields[planSteps.indexOf(step)].map((field) => (
                  <FieldControl
                    key={field.key}
                    field={field}
                    value={draft[field.key] ?? ''}
                    onChange={(value) => {
                      setDraft({ ...draft, [field.key]: value });
                      setError('');
                    }}
                  />
                ))}
              </div>
              {step === 'Бонусы' && (
                <Empty
                  title="Бонусы не настроены"
                  text="В текущей версии источника для этого шага нет доступных параметров."
                />
              )}
              {error && (
                <p className="ws-error" role="alert">
                  {error}
                </p>
              )}
              <div className="ws-actions ws-step-actions">
                <Button
                  variant="secondary"
                  disabled={step === planSteps[0]}
                  onClick={() => setStep(planSteps[planSteps.indexOf(step) - 1])}
                >
                  <ArrowLeft size={14} />
                  Назад
                </Button>
                {step !== planSteps.at(-1) && (
                  <Button
                    variant="secondary"
                    onClick={() => setStep(planSteps[planSteps.indexOf(step) + 1])}
                  >
                    Далее
                    <ArrowRight size={14} />
                  </Button>
                )}
              </div>
            </div>
            <div className="ws-panel-footer">
              {data.plans.some((plan) => plan.id === draft.id) && draft.status !== 'В архиве' && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    put('plans', { ...draft, status: 'В архиве' });
                    setDraft(null);
                    setMessage('Абонемент перемещён в архив.');
                  }}
                >
                  В архив
                </Button>
              )}
              <Button variant="secondary" onClick={() => savePlan(false)}>
                Сохранить черновик
              </Button>
              <Button onClick={() => savePlan(true)}>Опубликовать</Button>
            </div>
          </section>
          <aside className="panel ws-plan-preview">
            <span className="eyebrow">КАРТОЧКА ДЛЯ КЛИЕНТА</span>
            <div
              className="ws-plan-mark"
              style={{ background: draft.color || 'var(--color-accent)' }}
            />
            <h2>{draft.name || 'Название абонемента'}</h2>
            <p>{draft.short || 'Короткое описание'}</p>
            <strong className="ws-price">{money(draft.price)}</strong>
            <dl className="ws-facts">
              <div>
                <dt>Посещения</dt>
                <dd>
                  {draft.type === 'Безлимитный'
                    ? 'Без ограничений'
                    : draft.type === 'Разовое посещение'
                      ? '1 посещение'
                      : `${draft.visits || '—'} занятий`}
                </dd>
              </div>
              <div>
                <dt>Срок</dt>
                <dd>{draft.duration || '—'} дней</dd>
              </div>
              <div>
                <dt>Клуб</dt>
                <dd>{draft.club || 'Все клубы'}</dd>
              </div>
              <div>
                <dt>Начало</dt>
                <dd>{draft.activation || 'С первого посещения'}</dd>
              </div>
            </dl>
            {draft.hours && <p>{draft.hours}</p>}
            {draft.description && <p>{draft.description}</p>}
          </aside>
        </div>
      </div>
    );
  const plans = data.plans.filter(
    (row) =>
      (!category || row.category === category) &&
      row.name.toLowerCase().includes(query.toLowerCase()) &&
      (filter === 'Все' ||
        (filter === 'Онлайн'
          ? row.online === 'Доступен'
          : filter === 'В архиве'
            ? row.status === 'В архиве'
            : row.status === filter)),
  );
  return (
    <div className="ws-stack">
      {message && <Notice tone="success">{message}</Notice>}
      {!category ? (
        <>
          <div className="ws-actions">
            <Button onClick={() => setCategoryForm('new')}>
              <Plus size={15} />
              Категория
            </Button>
          </div>
          <div className="ws-card-grid">
            {data.categories.map((row) => (
              <button
                className="panel ws-link-card"
                key={row.id}
                onClick={() => setCategory(row.id)}
              >
                <span>
                  <strong>{row.name}</strong>
                  <small>
                    {row.club} · Тарифов:{' '}
                    {data.plans.filter((plan) => plan.category === row.id).length}
                  </small>
                </span>
                <ChevronRight size={18} />
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="ws-subheading">
          <Back onClick={() => setCategory(null)}>Все категории</Back>
          <Button variant="secondary" onClick={() => setCategoryForm(selected!)}>
            Изменить категорию
          </Button>
        </div>
      )}
      <section className="panel ws-panel">
        <div className="ws-panel-heading">
          <div>
            <h2>{selected?.name || 'Все абонементы'}</h2>
            <p>Условия, стоимость и доступность покупки.</p>
          </div>
          <Button
            onClick={() => {
              setDraft({
                id: demoId('plan'),
                category: category || data.categories[0]?.id || '',
                name: '',
                type: 'Безлимитный',
                duration: '30',
                visits: '0',
                price: '',
                discount: '0',
                activation: 'С первого посещения',
                club: 'Все клубы',
                online: 'Недоступен',
                color: '#8A332C',
                status: 'Черновик',
              });
              setStep(planSteps[0]);
              setError('');
            }}
            disabled={!data.categories.length}
          >
            <Plus size={15} />
            Абонемент
          </Button>
        </div>
        <Tabs
          items={['Все', 'Опубликован', 'Черновик', 'Онлайн', 'В архиве']}
          value={filter}
          onChange={setFilter}
          label="Фильтр абонементов"
        />
        <div className="ws-toolbar">
          <SearchBox value={query} onChange={setQuery} placeholder="Название абонемента" />
        </div>
        <DataTable
          rows={plans}
          columns={[
            { key: 'name', label: 'Название' },
            { key: 'type', label: 'Тип' },
            { key: 'duration', label: 'Дней' },
            { key: 'price', label: 'Стоимость' },
            { key: 'online', label: 'Онлайн' },
            { key: 'status', label: 'Статус' },
          ]}
          onOpen={(row) => {
            setDraft({ ...row });
            setStep(planSteps[0]);
            setError('');
          }}
        />
      </section>
      <SectionLinks ids={['services', 'directories']} navigate={navigate} />
      {categoryForm && (
        <RecordForm
          title={categoryForm === 'new' ? 'Новая категория' : 'Категория абонементов'}
          fields={[
            { key: 'name', label: 'Название', required: true },
            { key: 'description', label: 'Описание для сотрудников', type: 'textarea' },
            { key: 'group', label: 'Группа' },
            { ...clubField, options: ['Все клубы', ...clubField.options!] },
            { key: 'discount', label: 'Корпоративная скидка', options: ['Нет', 'Да'] },
            { key: 'sort', label: 'Порядок', type: 'number', min: 0 },
          ]}
          initial={categoryForm === 'new' ? undefined : categoryForm}
          onClose={closeCategory}
          onSave={(record) => {
            put('categories', { ...record, status: 'Активна' });
            closeCategory();
            setMessage('Категория сохранена.');
          }}
        />
      )}
    </div>
  );
}

export function RegistrationWorkspace({
  members,
  initialMember,
  clubName,
  onRegister,
  onMember,
}: {
  members: Member[];
  initialMember: Member | null;
  clubName: string;
  onRegister: (member: Member, kind: VisitKind) => void;
  onMember: (member: Member) => void;
}) {
  const [selected, setSelected] = useState<Member | null>(initialMember);
  const [kind, setKind] = useState<VisitKind>('gym');
  const [confirmed, setConfirmed] = useState(false);
  return (
    <div className="ws-two-column">
      <section className="panel ws-panel">
        <div className="ws-panel-heading">
          <div>
            <h2>1. Найдите клиента</h2>
            <p>Карта, ФИО или телефон. Выбор клиента не создаёт посещение.</p>
          </div>
        </div>
        <div className="ws-panel-body">
          <ClientSearch
            mode="selection"
            members={members}
            onMember={(member) => {
              setSelected(member);
              setConfirmed(false);
            }}
          />
          {selected && (
            <div className="ws-selected-client">
              <h3>{selected.name}</h3>
              <p>{selected.phone}</p>
              <p>
                {selected.plan} · до {selected.expires}
              </p>
              <Button variant="secondary" onClick={() => onMember(selected)}>
                Открыть карточку
              </Button>
            </div>
          )}
        </div>
      </section>
      <section className="panel ws-panel">
        <div className="ws-panel-heading">
          <div>
            <h2>2. Подтвердите посещение</h2>
            <p>{clubName}</p>
          </div>
        </div>
        <div className="ws-panel-body ws-stack">
          {selected ? (
            <>
              <p>
                Клиент: <strong>{selected.name}</strong>
              </p>
              <label className="form-field">
                <span>Тип посещения</span>
                <select
                  value={kind}
                  onChange={(e) => {
                    setKind(e.target.value as VisitKind);
                    setConfirmed(false);
                  }}
                >
                  {Object.entries(visitKinds).map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              {selected.status !== 'active' && (
                <Notice tone="warning">
                  Проверьте условия абонемента перед регистрацией. Проверка реальных ограничений не
                  подключена.
                </Notice>
              )}
              <Button
                disabled={confirmed}
                onClick={() => {
                  onRegister(selected, kind);
                  setConfirmed(true);
                }}
              >
                <Check size={15} />
                {confirmed ? 'Посещение зарегистрировано' : 'Зарегистрировать посещение'}
              </Button>
              {confirmed && (
                <Notice tone="success">Посещение появилось в журнале на главной.</Notice>
              )}
            </>
          ) : (
            <Empty
              title="Сначала выберите клиента"
              text="Здесь появятся его абонемент и параметры посещения."
            />
          )}
        </div>
      </section>
    </div>
  );
}

export function StatisticsWorkspace() {
  const { data } = useWorkspace();
  const [report, setReport] = useState<string | null>(null);
  const [from, setFrom] = useState('2026-11-01');
  const [to, setTo] = useState(TODAY);
  const [club, setClub] = useState('Все клубы');
  const [compare, setCompare] = useState('Без сравнения');
  const [group, setGroup] = useState('По дням');
  const filtered = data.ledger.filter(
    (row) => row.date >= from && row.date <= to && (club === 'Все клубы' || row.club === club),
  );
  const total = filtered.reduce((sum, row) => sum + Number(row.amount), 0);
  const grouped = new Map<string, number>();
  filtered.forEach((row) => {
    const key =
      group === 'По клубам' ? row.club : group === 'По категориям' ? row.category : row.date;
    grouped.set(key, (grouped.get(key) || 0) + Number(row.amount));
  });
  const days = Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1;
  const previous = data.ledger
    .filter(
      (row) =>
        row.date >= datePlus(from, -days) &&
        row.date < from &&
        (club === 'Все клубы' || row.club === club),
    )
    .reduce((sum, row) => sum + Number(row.amount), 0);
  if (!report)
    return (
      <div className="ws-stack">
        <div className="ws-card-grid">
          {['Обзор продаж', 'Выручка'].map((name) => (
            <button className="panel ws-link-card" key={name} onClick={() => setReport(name)}>
              <span>
                <strong>{name}</strong>
                <small>Период, клуб, сравнение и детализация</small>
              </span>
              <ArrowRight size={18} />
            </button>
          ))}
        </div>
        {[
          'Клиенты',
          'Посещаемость',
          'Тренеры',
          'Обратная связь',
          'Звонки',
          'Прогнозы и когорты',
        ].map((name) => (
          <section className="panel ws-panel-body" key={name}>
            <div className="ws-subheading">
              <h3>{name}</h3>
              <Status>Пока недоступно</Status>
            </div>
            <p className="ws-muted">
              В источнике отчёты этой категории недоступны. Их экраны будут разработаны после
              уточнения состава и прав доступа.
            </p>
          </section>
        ))}
        <Notice>
          В прототипе отчёты рассчитываются по вымышленным продажам. В источнике просмотрен экран
          параметров; получение данных завершилось ошибкой.
        </Notice>
      </div>
    );
  return (
    <div className="ws-stack">
      <Back onClick={() => setReport(null)}>Все отчёты</Back>
      <section className="panel ws-panel">
        <div className="ws-panel-heading">
          <div>
            <h2>{report}</h2>
            <p>Часовой пояс: Москва · валюта: ₽</p>
          </div>
        </div>
        <div className="ws-toolbar ws-report-filters">
          <label className="form-field">
            <span>Начало периода</span>
            <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="form-field">
            <span>Конец периода</span>
            <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
          </label>
          <label className="form-field">
            <span>Клуб</span>
            <select value={club} onChange={(e) => setClub(e.target.value)}>
              {['Все клубы', 'Центральный', 'Парк', 'Речной'].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>Сравнение</span>
            <select value={compare} onChange={(e) => setCompare(e.target.value)}>
              <option>Без сравнения</option>
              <option>Предыдущий период</option>
            </select>
          </label>
          <label className="form-field">
            <span>Детализация</span>
            <select value={group} onChange={(e) => setGroup(e.target.value)}>
              <option>По дням</option>
              <option>По клубам</option>
              <option>По категориям</option>
            </select>
          </label>
        </div>
      </section>
      {!from || !to || from > to ? (
        <Notice tone="warning">Укажите корректный период.</Notice>
      ) : (
        <>
          <Stats
            items={[
              { label: 'Выручка', value: money(total) },
              { label: 'Продажи', value: filtered.length },
              {
                label: 'Средний чек',
                value: money(filtered.length ? Math.round(total / filtered.length) : 0),
              },
              ...(compare !== 'Без сравнения'
                ? [
                    {
                      label: 'Предыдущий период',
                      value: money(previous),
                      note: previous
                        ? `${Math.round((total / previous - 1) * 100)}% к предыдущему`
                        : 'Нет продаж за прошлый период',
                    },
                  ]
                : []),
            ]}
          />
          <section className="panel ws-panel">
            <div className="ws-panel-heading">
              <h2>Распределение выручки</h2>
            </div>
            <div className="ws-panel-body ws-bars">
              {[...grouped.entries()].map(([key, amount]) => (
                <div key={key}>
                  <span>{group === 'По дням' ? prettyDate(key) : key}</span>
                  <div>
                    <i style={{ width: `${(amount / Math.max(...grouped.values(), 1)) * 100}%` }} />
                  </div>
                  <strong>{money(amount)}</strong>
                </div>
              ))}
              {!grouped.size && <Empty title="За этот период продаж нет" />}
            </div>
          </section>
          <section className="panel ws-panel">
            <div className="ws-panel-heading">
              <h2>Продажи за период</h2>
            </div>
            <DataTable
              rows={filtered}
              columns={[
                { key: 'date', label: 'Дата' },
                { key: 'name', label: 'Позиция' },
                { key: 'club', label: 'Клуб' },
                { key: 'amount', label: 'Сумма' },
                { key: 'method', label: 'Оплата' },
              ]}
            />
          </section>
        </>
      )}
    </div>
  );
}

export function SaleWorkspace({
  members,
  initialMember,
  navigate,
  clubName,
}: {
  members: Member[];
  initialMember: Member | null;
  navigate: Navigate;
  clubName: string;
}) {
  const { data, put } = useWorkspace();
  const [memberId, setMemberId] = useState(initialMember ? String(initialMember.id) : '');
  const [planId, setPlanId] = useState('');
  const [method, setMethod] = useState('Карта');
  const [done, setDone] = useState(false);
  const plan = data.plans.find((row) => row.id === planId);
  return (
    <div className="ws-stack">
      <SectionLinks ids={['memberships', 'cash']} navigate={navigate} />
      <div className="ws-two-column">
        <section className="panel ws-panel">
          <div className="ws-panel-heading">
            <h2>Продажа абонемента</h2>
          </div>
          <div className="ws-panel-body ws-stack">
            <label className="form-field">
              <span>Клиент</span>
              <select
                value={memberId}
                onChange={(e) => {
                  setMemberId(e.target.value);
                  setDone(false);
                }}
              >
                <option value="">Выберите клиента</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field">
              <span>Абонемент</span>
              <select
                value={planId}
                onChange={(e) => {
                  setPlanId(e.target.value);
                  setDone(false);
                }}
              >
                <option value="">Выберите абонемент</option>
                {data.plans
                  .filter((row) => row.status === 'Опубликован')
                  .map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name} · {money(row.price)}
                    </option>
                  ))}
              </select>
            </label>
            <label className="form-field">
              <span>Способ оплаты</span>
              <select value={method} onChange={(e) => setMethod(e.target.value)}>
                <option>Карта</option>
                <option>Наличные</option>
              </select>
            </label>
            <Notice>Это демонстрация продажи. Реальная оплата не производится.</Notice>
          </div>
        </section>
        <section className="panel ws-panel">
          <div className="ws-panel-heading">
            <h2>Проверьте продажу</h2>
          </div>
          <div className="ws-panel-body ws-stack">
            {plan && memberId ? (
              <>
                <p>{members.find((member) => String(member.id) === memberId)?.name}</p>
                <h3>{plan.name}</h3>
                <p>
                  {plan.duration} дней · {plan.type}
                </p>
                <strong className="ws-price">{money(plan.price)}</strong>
                <Button
                  disabled={done}
                  onClick={() => {
                    put('ledger', {
                      id: demoId('sale'),
                      name: plan.name,
                      category: 'Абонементы',
                      date: TODAY,
                      club: clubName.split(' · ').at(-1) || 'Центральный',
                      client: members.find((member) => String(member.id) === memberId)!.name,
                      amount: plan.price,
                      method,
                      status: 'Оплачено',
                      memberId,
                    });
                    put('issued-plans', { ...plan, id: demoId('issued'), memberId, issued: TODAY });
                    setDone(true);
                  }}
                >
                  {done ? 'Демопродажа сохранена' : 'Подтвердить демопродажу'}
                </Button>
                {done && (
                  <Notice tone="success">
                    Продажа появилась в кассе и отчётах. Абонемент добавлен в карточку клиента.
                  </Notice>
                )}
              </>
            ) : (
              <Empty
                title="Выберите клиента и абонемент"
                text="Затем здесь можно проверить сумму и подтвердить демопродажу."
              />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export function BarWorkspace({ navigate, clubName }: { navigate: Navigate; clubName: string }) {
  const { data, put, barOpen, setBarOpen } = useWorkspace();
  const [cart, setCart] = useState<Record<string, number>>({});
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Все');
  const [method, setMethod] = useState('Карта');
  const [message, setMessage] = useState('');
  const [closing, setClosing] = useState(false);
  const close = useCallback(() => setClosing(false), []);
  const products = data.products.filter((row) => row.status === 'Активен');
  const lines = Object.entries(cart)
    .filter(([, quantity]) => quantity > 0)
    .map(([id, quantity]) => ({ product: products.find((row) => row.id === id)!, quantity }))
    .filter((line) => line.product);
  const total = lines.reduce((sum, line) => sum + Number(line.product.price) * line.quantity, 0);
  if (!barOpen)
    return (
      <div className="ws-stack">
        <SectionLinks ids={['products', 'inventory']} navigate={navigate} />
        <section className="panel ws-shift-gate">
          <span className="ws-feature-icon">
            <CupSoda size={30} />
          </span>
          <h2>Бар готов к работе</h2>
          <p>{clubName} · Бар у ресепшена</p>
          <Button onClick={() => setBarOpen(true)}>Открыть демосмену</Button>
          <small>
            На исходном сайте смена не открывалась. Экран продажи ниже — предлагаемый демосценарий
            для обсуждения.
          </small>
        </section>
      </div>
    );
  return (
    <div className="ws-stack">
      <div className="ws-subheading">
        <Status>Смена открыта</Status>
        <SectionLinks ids={['products', 'inventory']} navigate={navigate} />
        <Button variant="ghost" onClick={() => setClosing(true)}>
          Закрыть смену…
        </Button>
      </div>
      {message && <Notice tone="success">{message}</Notice>}
      <div className="ws-pos">
        <section className="panel ws-panel">
          <div className="ws-toolbar">
            <SearchBox
              value={query}
              onChange={setQuery}
              placeholder="Название, артикул или штрихкод"
            />
          </div>
          <Tabs
            items={['Все', ...data['bar-categories'].map((row) => row.name)]}
            value={category}
            onChange={setCategory}
            label="Категории бара"
          />
          <div className="ws-product-grid">
            {products
              .filter(
                (row) =>
                  (category === 'Все' || row.category === category) &&
                  `${row.name} ${row.sku} ${row.barcode}`
                    .toLowerCase()
                    .includes(query.toLowerCase()),
              )
              .map((product) => (
                <button
                  key={product.id}
                  disabled={(cart[product.id] || 0) >= Number(product.stock)}
                  onClick={() => setCart({ ...cart, [product.id]: (cart[product.id] || 0) + 1 })}
                >
                  <CupSoda size={23} />
                  <strong>{product.name}</strong>
                  <b>{money(product.price)}</b>
                  <small>
                    Остаток: {product.stock} {product.unit}
                  </small>
                </button>
              ))}
          </div>
        </section>
        <section className="panel ws-panel ws-check">
          <div className="ws-panel-heading">
            <h2>Текущий заказ</h2>
          </div>
          <div className="ws-panel-body ws-stack">
            {!lines.length && <Empty title="Заказ пуст" text="Выберите товар в каталоге." />}
            {lines.map(({ product, quantity }) => (
              <div className="ws-cart-line" key={product.id}>
                <strong>
                  {product.name}
                  <small>{money(Number(product.price) * quantity)}</small>
                </strong>
                <div className="ws-quantity">
                  <button
                    aria-label={`Уменьшить: ${product.name}`}
                    onClick={() => setCart({ ...cart, [product.id]: quantity - 1 })}
                  >
                    −
                  </button>
                  <span>{quantity}</span>
                  <button
                    aria-label={`Увеличить: ${product.name}`}
                    disabled={quantity >= Number(product.stock)}
                    onClick={() => setCart({ ...cart, [product.id]: quantity + 1 })}
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
            <label className="form-field">
              <span>Оплата</span>
              <select value={method} onChange={(e) => setMethod(e.target.value)}>
                <option>Карта</option>
                <option>Наличные</option>
              </select>
            </label>
            <div className="ws-total">
              <span>Итого</span>
              <strong>{money(total)}</strong>
            </div>
            <Button
              disabled={!lines.length}
              onClick={() => {
                if (lines.some((line) => line.quantity > Number(line.product.stock))) {
                  setMessage('Остатки изменились. Проверьте заказ.');
                  return;
                }
                lines.forEach(({ product, quantity }) => {
                  put('products', { ...product, stock: String(Number(product.stock) - quantity) });
                  put('ledger', {
                    id: demoId('sale'),
                    name: `${product.name} × ${quantity}`,
                    category: 'Бар',
                    date: TODAY,
                    club: clubName.split(' · ').at(-1) || 'Центральный',
                    client: 'Гость',
                    amount: String(Number(product.price) * quantity),
                    method,
                    status: 'Оплачено',
                  });
                });
                setCart({});
                setMessage('Демозаказ сохранён в кассе; остатки обновлены. Реальной оплаты нет.');
              }}
            >
              Подтвердить демозаказ
            </Button>
          </div>
        </section>
      </div>
      {closing && (
        <Modal
          title="Закрыть демосмену бара?"
          subtitle="Незавершённый заказ будет очищен. Сохранённые продажи останутся в кассе."
          onClose={close}
        >
          <div className="modal-actions">
            <Button variant="secondary" onClick={close}>
              Продолжить работу
            </Button>
            <Button
              onClick={() => {
                setBarOpen(false);
                setCart({});
                close();
              }}
            >
              Закрыть смену
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

export function InventoryWorkspace({ navigate }: { navigate: Navigate }) {
  const { data, put } = useWorkspace();
  const [form, setForm] = useState<DemoRecord | 'new' | null>(null);
  const [opened, setOpened] = useState<DemoRecord | null>(null);
  const [posting, setPosting] = useState(false);
  const [message, setMessage] = useState('');
  const closeForm = useCallback(() => setForm(null), []);
  const close = useCallback(() => {
    setOpened(null);
    setPosting(false);
  }, []);
  const fields: Field[] = [
    { key: 'name', label: 'Номер / название документа', required: true },
    {
      key: 'type',
      label: 'Операция',
      options: ['Поступление', 'Перемещение', 'Списание'],
      required: true,
    },
    { key: 'date', label: 'Дата', type: 'date', required: true },
    { key: 'supplier', label: 'Поставщик' },
    {
      key: 'from',
      label: 'Откуда',
      options: ['Центральный · Бар', 'Центральный · Склад', 'Парк · Бар'],
    },
    {
      key: 'to',
      label: 'Куда',
      options: ['Центральный · Бар', 'Центральный · Склад', 'Парк · Бар'],
    },
    {
      key: 'product',
      label: 'Товар',
      options: data.products.map((row) => row.name),
      required: true,
    },
    { key: 'qty', label: 'Количество в базовых единицах', type: 'number', min: 1, required: true },
    { key: 'cost', label: 'Закупочная цена, ₽', type: 'number', min: 0 },
    { key: 'batch', label: 'Партия' },
  ];
  const viewRows = data.inventory.map((row) => ({
    ...row,
    product: data.products.find((product) => product.id === row.product)?.name || row.product,
  }));
  const post = () => {
    if (!opened || opened.status === 'Проведён') return;
    const product = data.products.find(
      (row) => row.id === opened.product || row.name === opened.product,
    );
    if (!product) {
      setMessage('Товар не найден в каталоге.');
      return;
    }
    let nextStock: number;
    try {
      nextStock = inventoryStock(opened, product);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Не удалось провести документ.');
      close();
      return;
    }
    put('products', { ...product, stock: String(nextStock) });
    put('inventory', { ...opened, product: product.id, status: 'Проведён' });
    close();
    setMessage(
      opened.type === 'Перемещение'
        ? 'Демодокумент проведён. Общий остаток товара не изменился.'
        : 'Демодокумент проведён. Общий остаток товара обновлён.',
    );
  };
  return (
    <div className="ws-stack">
      <SectionLinks ids={['products', 'bar']} navigate={navigate} />
      {message && <Notice>{message}</Notice>}
      <section className="panel ws-panel">
        <div className="ws-panel-heading">
          <div>
            <h2>Складские документы</h2>
            <p>
              В этом прототипе остатки общие. Учёт по отдельным складам требует уточнения правил.
            </p>
          </div>
          <Button onClick={() => setForm('new')}>
            <Plus size={15} />
            Документ
          </Button>
        </div>
        <DataTable
          rows={viewRows}
          columns={[
            { key: 'name', label: 'Документ' },
            { key: 'date', label: 'Дата' },
            { key: 'product', label: 'Товар' },
            { key: 'qty', label: 'Количество' },
            { key: 'status', label: 'Статус' },
          ]}
          onOpen={(row) => setOpened(data.inventory.find((record) => record.id === row.id)!)}
        />
      </section>
      {form && (
        <RecordForm
          title="Складской документ"
          fields={fields}
          initial={
            form === 'new'
              ? undefined
              : {
                  ...form,
                  product:
                    data.products.find((row) => row.id === form.product)?.name || form.product,
                }
          }
          onClose={closeForm}
          submit="Сохранить черновик"
          onSave={(record) => {
            put('inventory', {
              ...record,
              product:
                data.products.find((row) => row.name === record.product)?.id || record.product,
              status: 'Черновик',
            });
            closeForm();
            setMessage('Черновик сохранён. Остатки не изменились.');
          }}
        />
      )}
      {opened && (
        <RecordDetails
          title={opened.name}
          record={{
            ...opened,
            product: data.products.find((row) => row.id === opened.product)?.name || opened.product,
          }}
          fields={fields}
          onClose={close}
          actions={
            opened.status === 'Черновик' ? (
              <>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setForm(opened);
                    close();
                  }}
                >
                  Редактировать
                </Button>
                {posting ? (
                  <div className="ws-confirm">
                    <p>
                      Провести документ? Он повлияет на демоостатки и станет доступен только для
                      просмотра.
                    </p>
                    <Button variant="secondary" onClick={() => setPosting(false)}>
                      Отмена
                    </Button>
                    <Button onClick={post}>Подтвердить проведение</Button>
                  </div>
                ) : (
                  <Button onClick={() => setPosting(true)}>Провести…</Button>
                )}
              </>
            ) : (
              <Status>Проведён</Status>
            )
          }
        />
      )}
    </div>
  );
}

export function CashWorkspace({ navigate }: { navigate: Navigate }) {
  const { data } = useWorkspace();
  const rows = data.ledger.filter((row) => row.date === TODAY);
  return (
    <div className="ws-stack">
      <SectionLinks ids={['services', 'bar', 'statistics']} navigate={navigate} />
      <Stats
        items={[
          { label: 'Продажи сегодня', value: rows.length },
          { label: 'Всего', value: money(rows.reduce((sum, row) => sum + Number(row.amount), 0)) },
          {
            label: 'Наличными',
            value: money(
              rows
                .filter((row) => row.method === 'Наличные')
                .reduce((sum, row) => sum + Number(row.amount), 0),
            ),
          },
          {
            label: 'Картой',
            value: money(
              rows
                .filter((row) => row.method === 'Карта')
                .reduce((sum, row) => sum + Number(row.amount), 0),
            ),
          },
        ]}
      />
      <section className="panel ws-panel">
        <div className="ws-panel-heading">
          <div>
            <h2>Операции смены</h2>
            <p>Продажи услуг и бара из единого набора демоданных.</p>
          </div>
        </div>
        <DataTable
          rows={rows}
          columns={[
            { key: 'name', label: 'Позиция' },
            { key: 'client', label: 'Клиент' },
            { key: 'category', label: 'Категория' },
            { key: 'amount', label: 'Сумма' },
            { key: 'method', label: 'Оплата' },
            { key: 'status', label: 'Статус' },
          ]}
        />
      </section>
    </div>
  );
}
