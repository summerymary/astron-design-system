import { Select } from '../components/Select';
import { quantityLabel } from '../data/membership-kinds';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowRight,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Copy,
  Maximize2,
  Minimize2,
  Move,
  Plus,
  Settings2,
  Trash2,
  Users,
} from 'lucide-react';
import { Button, Modal } from '../components/ui';
import {
  DataTable,
  Empty,
  Notice,
  SearchBox,
  Stats,
  Status,
  Tabs,
} from '../components/WorkspaceUI';
import type { Navigate } from '../components/WorkspaceUI';
import { demoId, useWorkspace } from '../components/WorkspaceProvider';
import { TODAY } from '../data/workspace';
import type { DemoRecord } from '../data/workspace';
import type { DemoUser, Member } from '../types';
import { PersonalTrainingForm, personalDraft } from './StaffWorkspace';
import { canManageEvent, personalScopeError } from '../lib/staff-rules';
import {
  addDays,
  calendarBounds,
  clock,
  dayText,
  eventTime,
  layoutEvents,
  minutes,
  moveEvent,
  nextFreeTime,
  sameSlot,
  slotAt,
  templateEvent,
  validateEvent,
  weekStart,
} from '../lib/schedule';
import type { ScheduleColumn } from '../lib/schedule';
import '../styles/schedule.css';

type PendingMove = { before: DemoRecord; after: DemoRecord };
type Drag = {
  event: DemoRecord;
  pointer: number;
  x: number;
  y: number;
  offset: number;
  active: boolean;
  target: DemoRecord | null;
};

export function ScheduleWorkspace({
  members,
  navigate,
  clubName,
  user,
}: {
  members: Member[];
  navigate: Navigate;
  clubName: string;
  user: DemoUser;
}) {
  const { data, put, remove } = useWorkspace();
  const isTrainer = user.role === 'trainer';
  const canEdit = (event: DemoRecord) => canManageEvent(event, user);
  const saved = data['calendar-view']?.find((r) => r.id === user.id);
  const [day, setDay] = useState(saved?.day || TODAY);
  const [view, setView] = useState(saved?.view || 'День');
  const [club, setClub] = useState(saved?.club || clubName.split(' · ').at(-1) || 'Центральный');
  const [room, setRoom] = useState(saved?.room || 'Все залы');
  const [trainer, setTrainer] = useState(isTrainer ? user.name : saved?.trainer || 'Все тренеры');
  const [scale, setScale] = useState(saved?.scale || 'Комфортно');
  const [step, setStep] = useState(
    saved?.step || data.preferences?.find((r) => r.id === 'schedule')?.step || '5',
  );
  const [fullscreen, setFullscreen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [openedId, setOpenedId] = useState('');
  const [editing, setEditing] = useState<DemoRecord | null>(null);
  const [library, setLibrary] = useState<DemoRecord | null>(null);
  const [query, setQuery] = useState('');
  const [pending, setPending] = useState<PendingMove | null>(null);
  const [deleting, setDeleting] = useState<DemoRecord | null>(null);
  const [undo, setUndo] = useState<PendingMove | null>(null);
  const [copying, setCopying] = useState(false);
  const [booking, setBooking] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [ghost, setGhost] = useState<DemoRecord | null>(null);
  const [context, setContext] = useState<{
    event?: DemoRecord;
    slot: DemoRecord;
    x: number;
    y: number;
  } | null>(null);
  const contextRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (context) contextRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
  }, [context]);
  const [available, setAvailable] = useState({ height: 580, width: 900, heading: 40 });
  const root = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const suppressClick = useRef(false);
  const dialog = Boolean(
    openedId || editing || library || pending || deleting || copying || context,
  );
  const activeRooms = data.rooms.filter((r) => r.club === club && r.status !== 'В архиве');
  const trainers = [
    ...new Set(
      [
        ...data.events.map((e) => e.trainer),
        ...data['training-templates'].map((t) => t.trainer),
        ...data.employees.filter((e) => /Тренер/.test(e.position)).map((e) => e.name),
      ].filter(Boolean),
    ),
  ];
  const week = weekStart(day);
  const dates = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  const events = data.events.filter(
    (e) =>
      e.club === club &&
      (!isTrainer || e.trainer === user.name) &&
      (room === 'Все залы' || e.room === room) &&
      (trainer === 'Все тренеры' || e.trainer === trainer) &&
      (view === 'Неделя' ? dates.includes(e.day) : e.day === day),
  );
  const opened = data.events.find((e) => e.id === openedId);
  const columns: ScheduleColumn[] =
    view === 'Неделя'
      ? dates.map((date) => ({
          key: date,
          day: date,
          room: room === 'Все залы' ? '' : room,
          label: dayText(date, true),
        }))
      : activeRooms
          .filter((r) => room === 'Все залы' || r.name === room)
          .filter(
            (r) =>
              !isTrainer ||
              room !== 'Все залы' ||
              !events.length ||
              events.some((e) => e.room === r.name),
          )
          .map((r) => ({ key: r.id, day, room: r.name, label: r.name }));
  const { start, end } = calendarBounds(events);
  const shortest = Math.min(50, ...events.map((e) => Number(e.duration)));
  const minTarget =
    scale === 'Весь день'
      ? available.width < 540
        ? 64
        : view === 'Неделя'
          ? 60
          : 20
      : view === 'Неделя'
        ? 72
        : available.width < 540
          ? 64
          : 52;
  const gridHeight = Math.max(
    available.height,
    ((end - start) / shortest) * minTarget,
    scale === 'Крупнее' ? (end - start) * 1.4 : 0,
  );
  const hours = Array.from(
    { length: Math.ceil((end - start) / 60) + 1 },
    (_, i) => start + i * 60,
  ).filter((t) => t <= end);
  const closeDetails = useCallback(() => {
    setOpenedId('');
    setBooking('');
  }, []);
  const closeEditing = useCallback(() => setEditing(null), []);
  const closeLibrary = useCallback(() => setLibrary(null), []);
  const closePending = useCallback(() => {
    setPending(null);
    setError('');
  }, []);
  const closeCopy = useCallback(() => setCopying(false), []);
  const closeDelete = useCallback(() => {
    setDeleting(null);
    setError('');
  }, []);

  // View preferences live in the same resettable memory as the prototype data.
  useEffect(() => {
    put('calendar-view', { id: user.id, day, view, club, room, trainer, scale, step });
    // put is intentionally not a dependency: provider creates it on every update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day, view, club, room, trainer, scale, step]);
  useLayoutEffect(() => {
    const measure = () => {
      if (!scroller.current || !root.current) return;
      const rect = scroller.current.getBoundingClientRect();
      const viewportBottom =
        root.current.closest('.app-main')?.getBoundingClientRect().bottom || window.innerHeight;
      const heading =
        root.current.querySelector('.calendar-time-heading')?.getBoundingClientRect().height || 40;
      const footer =
        root.current.querySelector('.calendar-footer')?.getBoundingClientRect().height || 36;
      setAvailable({
        height: Math.max(
          280,
          Math.min(window.innerHeight, viewportBottom) -
            rect.top -
            heading -
            footer -
            (fullscreen ? 28 : 8),
        ),
        width: root.current.clientWidth,
        heading,
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (root.current) observer.observe(root.current);
    const panel = root.current?.querySelector('.calendar-panel');
    if (panel) observer.observe(panel);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [fullscreen, view]);
  useEffect(() => {
    if (!fullscreen || dialog) return;
    const before = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusables = () =>
      Array.from(
        root.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), select, input, summary, [tabindex="0"]',
        ) || [],
      ).filter((el) => el.getClientRects().length);
    focusables()[0]?.focus();
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false);
      if (e.key === 'Tab') {
        const items = focusables();
        if (e.shiftKey && document.activeElement === items[0]) {
          e.preventDefault();
          items.at(-1)?.focus();
        } else if (!e.shiftKey && document.activeElement === items.at(-1)) {
          e.preventDefault();
          items[0]?.focus();
        }
      }
    };
    document.addEventListener('keydown', handle);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', handle);
      before?.focus();
    };
  }, [fullscreen, dialog]);
  useEffect(() => {
    const cancel = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && drag.current) {
        drag.current = null;
        setGhost(null);
        suppressClick.current = true;
        e.stopImmediatePropagation();
      }
    };
    document.addEventListener('keydown', cancel, true);
    return () => document.removeEventListener('keydown', cancel, true);
  }, []);

  const show = (event: DemoRecord) => {
    setOpenedId(event.id);
    setError('');
  };
  const requestDelete = (event: DemoRecord) => {
    if (!canEdit(event)) return;
    setDeleting({ ...event });
    setContext(null);
    closeDetails();
    setError('');
  };
  const deleteTraining = () => {
    if (!deleting) return;
    const current = data.events.find((event) => event.id === deleting.id);
    if (!current || !canEdit(current)) {
      setError('Занятие уже удалено или больше недоступно для изменения.');
      return;
    }
    if (Object.keys({ ...current, ...deleting }).some((key) => current[key] !== deleting[key])) {
      setError('Занятие изменилось. Закройте окно и проверьте его заново перед удалением.');
      return;
    }
    remove('events', current.id);
    if (undo?.after.id === current.id) setUndo(null);
    closeDelete();
    setMessage(
      `«${current.name}» удалено из расписания: ${dayText(current.day)}, ${eventTime(current)}, ${current.room}.`,
    );
  };
  const seed = (time?: string, selectedRoom?: string, selectedDay = day): DemoRecord => ({
    id: demoId('event'),
    day: selectedDay,
    time: time || '',
    club,
    room: selectedRoom || (room === 'Все залы' ? '' : room),
    keepRoom: selectedRoom ? 'true' : 'false',
    booked: '0',
    attendees: '',
    status: 'Запись открыта',
  });
  const openLibrary = (initial = seed()) => {
    if (isTrainer) {
      setEditing(
        personalDraft(
          data,
          user,
          initial.club,
          initial.day,
          initial.keepRoom === 'true' ? initial.room : '',
          initial.time,
        ),
      );
      return;
    }
    setQuery('');
    setLibrary(initial);
  };
  const applyTemplate = (template: DemoRecord) => {
    const draft = templateEvent(template, library!, data.rooms, trainers[0] || '');
    if (!draft.time)
      draft.time = nextFreeTime(
        data.events,
        draft.day,
        draft.club,
        draft.room,
        Number(draft.duration),
        draft.trainer,
      );
    setLibrary(null);
    setEditing(draft);
  };
  const requestMove = (before: DemoRecord, after: DemoRecord) => {
    if (sameSlot(before, after)) return;
    setError('');
    setPending({ before: { ...before }, after });
  };
  const finishMove = () => {
    if (!pending) return;
    const current = data.events.find((e) => e.id === pending.before.id);
    if (!current || !canEdit(current) || !sameSlot(current, pending.before)) {
      setError('Занятие уже изменилось. Закройте окно и выберите его заново.');
      return;
    }
    const after: DemoRecord = {
      ...pending.after,
      booked: current.booked,
      attendees: current.kind === 'personal' ? pending.after.memberId : current.attendees,
    };
    const problem =
      (after.kind === 'personal'
        ? personalScopeError(after, user, data['personal-clients'] || [])
        : null) || validateEvent(after, data.events, data.rooms);
    if (problem) {
      setError(problem);
      return;
    }
    put('events', after);
    setUndo({ before: current, after });
    setPending(null);
    setError('');
    setDay(after.day);
    setClub(after.club);
    if (room !== 'Все залы') setRoom(after.room);
    setMessage(
      `«${after.name}» перенесено: ${dayText(after.day)}, ${eventTime(after)}, ${after.room}.`,
    );
  };
  const startDrag = (e: ReactPointerEvent<HTMLButtonElement>, event: DemoRecord) => {
    if (e.button !== 0) return;
    suppressClick.current = false;
    if (e.pointerType === 'touch' || !canEdit(event)) return;
    const rect = e.currentTarget.getBoundingClientRect();
    drag.current = {
      event,
      pointer: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      offset: ((e.clientY - rect.top) / rect.height) * Number(event.duration),
      active: false,
      target: null,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onDrag = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const current = drag.current;
    if (!current || current.pointer !== e.pointerId) return;
    if (!current.active && Math.hypot(e.clientX - current.x, e.clientY - current.y) < 6) return;
    current.active = true;
    suppressClick.current = true;
    const column = [
      ...(root.current?.querySelectorAll<HTMLElement>('[data-calendar-column]') || []),
    ].find((el) => {
      const r = el.getBoundingClientRect();
      return (
        e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom
      );
    });
    if (!column) {
      current.target = null;
      setGhost(null);
      return;
    }
    const rect = column.getBoundingClientRect();
    const target = moveEvent(
      current.event,
      {
        day: column.dataset.day!,
        time: slotAt(
          e.clientY,
          rect.top,
          rect.height,
          start,
          end,
          Number(step),
          current.offset,
          Number(current.event.duration),
        ),
        room: column.dataset.room || current.event.room,
        club,
      },
      data.rooms,
    );
    current.target = target;
    setGhost(target);
  };
  const endDrag = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const current = drag.current;
    if (!current || current.pointer !== e.pointerId) return;
    drag.current = null;
    setGhost(null);
    if (current.active && current.target) requestMove(current.event, current.target);
  };
  const saveRecord = (record: DemoRecord): string | void => {
    if (isTrainer && record.kind !== 'personal')
      return 'Тренер может добавлять только свои персональные тренировки.';
    const before = data.events.find((e) => e.id === record.id);
    if (before && !canEdit(before)) return 'Эту тренировку нельзя изменить в выбранной роли.';
    const problem =
      (record.kind === 'personal'
        ? personalScopeError(record, user, data['personal-clients'] || [])
        : null) || validateEvent(record, data.events, data.rooms);
    if (problem) return problem;
    if (before && !sameSlot(before, record)) {
      setEditing(null);
      requestMove(before, record);
      return;
    }
    put('events', record);
    setEditing(null);
    setMessage(before ? 'Изменения сохранены.' : 'Тренировка добавлена в расписание.');
    setDay(record.day);
    setClub(record.club);
    if (room !== 'Все залы') setRoom(record.room);
  };

  const content = (
    <div
      ref={root}
      className={`calendar-workspace ${isTrainer ? 'calendar-is-trainer' : ''} calendar-scale-${scale === 'Весь день' ? 'fit' : 'comfortable'} ${fullscreen ? 'calendar-fullscreen' : ''}`}
      role={fullscreen ? 'dialog' : undefined}
      aria-modal={fullscreen ? true : undefined}
      aria-label={fullscreen ? 'Расписание на весь экран' : undefined}
    >
      {context &&
        createPortal(
          <>
            <button
              className="calendar-context-dismiss"
              aria-label="Закрыть быстрые действия"
              onClick={() => setContext(null)}
            />
            <div
              ref={contextRef}
              className="calendar-context-menu"
              role="menu"
              aria-label="Быстрые действия с расписанием"
              style={{
                left: Math.max(8, Math.min(context.x, window.innerWidth - 292)),
                top: Math.max(8, Math.min(context.y, window.innerHeight - 300)),
                maxHeight:
                  window.innerHeight -
                  Math.max(8, Math.min(context.y, window.innerHeight - 300)) -
                  8,
              }}
              onKeyDown={(e) => {
                const buttons = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('button')];
                if (e.key === 'Escape' || e.key === 'Tab') {
                  setContext(null);
                  return;
                }
                if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
                  e.preventDefault();
                  const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
                  buttons[
                    e.key === 'Home'
                      ? 0
                      : e.key === 'End'
                        ? buttons.length - 1
                        : (index + (e.key === 'ArrowDown' ? 1 : -1) + buttons.length) %
                          buttons.length
                  ]?.focus();
                }
              }}
            >
              <small>
                {context.event?.name || 'Свободное время'} · {context.slot.time}
              </small>
              {context.event && (
                <button
                  role="menuitem"
                  onClick={() => {
                    show(context.event!);
                    setContext(null);
                  }}
                >
                  Открыть занятие
                </button>
              )}
              {context.event && canEdit(context.event) && (
                <button
                  role="menuitem"
                  onClick={() => {
                    setEditing({ ...context.event! });
                    setContext(null);
                  }}
                >
                  Перенести / изменить
                </button>
              )}
              <button
                role="menuitem"
                onClick={() => {
                  openLibrary(context.slot);
                  setContext(null);
                }}
              >
                Добавить тренировку{context.event?.status === 'Отменено' ? ' на это время' : ''}
              </button>
              {context.event && canEdit(context.event) && (
                <button
                  role="menuitem"
                  className="calendar-delete-action"
                  onClick={() => requestDelete(context.event!)}
                >
                  <Trash2 size={18} aria-hidden="true" />
                  Удалить тренировку
                </button>
              )}
            </div>
          </>,
          document.body,
        )}
      <section className="calendar-panel panel">
        <div className="calendar-toolbar">
          <div className="calendar-date-nav">
            <button
              className="icon-button"
              aria-label={view === 'Неделя' ? 'Предыдущая неделя' : 'Предыдущий день'}
              onClick={() => setDay(addDays(day, view === 'Неделя' ? -7 : -1))}
            >
              <ChevronLeft size={18} />
            </button>
            <Button variant="secondary" onClick={() => setDay(TODAY)}>
              Сегодня
            </Button>
            <button
              className="icon-button"
              aria-label={view === 'Неделя' ? 'Следующая неделя' : 'Следующий день'}
              onClick={() => setDay(addDays(day, view === 'Неделя' ? 7 : 1))}
            >
              <ChevronRight size={18} />
            </button>
            <label className="calendar-date">
              <span className="sr-only">Дата расписания</span>
              <input
                type="date"
                value={day}
                onInput={(e) => e.currentTarget.value && setDay(e.currentTarget.value)}
                onChange={(e) => e.target.value && setDay(e.target.value)}
              />
            </label>
          </div>
          <Tabs
            items={['День', 'Неделя', 'Список']}
            value={view}
            onChange={setView}
            label="Вид расписания"
          />
          <div className="calendar-create">
            <Button
              variant="secondary"
              onClick={() => (isTrainer ? navigate('trainer-clients') : openLibrary())}
            >
              <BookOpen size={15} />
              {isTrainer ? 'Мои клиенты' : 'База тренировок'}
            </Button>
            <Button onClick={() => openLibrary()}>
              <Plus size={15} />
              {isTrainer ? 'Персональная тренировка' : 'Занятие'}
            </Button>
            <button
              className="icon-button"
              aria-label={fullscreen ? 'Свернуть расписание' : 'Расписание на весь экран'}
              title={fullscreen ? 'Свернуть' : 'Весь экран — все занятия перед глазами'}
              onClick={() => setFullscreen(!fullscreen)}
            >
              {fullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
          </div>
        </div>
        <div className="calendar-week-strip" aria-label="Дни недели">
          {dates.map((date) => (
            <button
              key={date}
              aria-pressed={date === day}
              onClick={() => {
                setDay(date);
                if (view === 'Список') setView('День');
              }}
              className={date === day ? 'selected' : ''}
            >
              <span>
                {new Date(`${date}T12:00:00Z`).toLocaleDateString('ru-RU', {
                  weekday: 'short',
                  timeZone: 'Europe/Moscow',
                })}
              </span>
              <b>{Number(date.slice(-2))}</b>
              {date === TODAY && <i aria-label="Сегодня" />}
            </button>
          ))}
        </div>
        <button
          className="calendar-filter-toggle"
          aria-label="Фильтры расписания"
          aria-expanded={filtersOpen}
          aria-controls="calendar-filters"
          onClick={() => setFiltersOpen(!filtersOpen)}
        >
          <Settings2 size={16} />
          <span>
            {room} · {scale}
          </span>
          <b>{events.length}</b>
          <ChevronRight size={16} className={filtersOpen ? 'is-open' : ''} />
        </button>
        <div
          className={`calendar-filters ${filtersOpen ? 'is-expanded' : ''}`}
          id="calendar-filters"
        >
          <label>
            <span className="sr-only">Клуб расписания</span>
            <Select
              value={club}
              disabled={isTrainer}
              onChange={(e) => {
                setClub(e.target.value);
                setRoom(
                  data.rooms.find((r) => r.club === e.target.value && r.status !== 'В архиве')
                    ?.name || 'Все залы',
                );
              }}
            >
              <option>Центральный</option>
              <option>Парк</option>
              <option>Речной</option>
            </Select>
          </label>
          <label>
            <span className="sr-only">Зал расписания</span>
            <Select
              value={room}
              onChange={(e) => {
                setRoom(e.target.value);
                setFiltersOpen(false);
              }}
            >
              <option>Все залы</option>
              {activeRooms.map((r) => (
                <option key={r.id}>{r.name}</option>
              ))}
            </Select>
          </label>
          <label>
            <span className="sr-only">Тренер расписания</span>
            <Select
              value={trainer}
              disabled={isTrainer}
              onChange={(e) => setTrainer(e.target.value)}
            >
              <option>Все тренеры</option>
              {trainers.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Select>
          </label>
          <label className="calendar-scale">
            <span className="sr-only">Масштаб расписания</span>
            <Select
              value={scale}
              onChange={(e) => {
                setScale(e.target.value);
                setFiltersOpen(false);
              }}
            >
              <option>Комфортно</option>
              <option>Весь день</option>
              <option>Крупнее</option>
            </Select>
          </label>
          <span className="calendar-count">
            Занятий: <b>{events.length}</b>
          </span>
          {!isTrainer && (
            <details className="calendar-more">
              <summary aria-label="Другие действия с расписанием">
                <Settings2 size={16} />
              </summary>
              <div>
                <label>
                  Шаг переноса
                  <Select
                    aria-label="Шаг переноса"
                    value={step}
                    onChange={(e) => setStep(e.target.value)}
                  >
                    <option value="5">5 минут</option>
                    <option value="15">15 минут</option>
                    <option value="30">30 минут</option>
                  </Select>
                </label>
                <Button variant="ghost" onClick={() => setCopying(true)}>
                  <Copy size={14} />
                  Из прошлой недели
                </Button>
                <Button variant="ghost" onClick={() => navigate('schedule-calendar')}>
                  Настройки календаря
                </Button>
                <Button variant="ghost" onClick={() => navigate('training-groups')}>
                  Группы тренировок
                </Button>
              </div>
            </details>
          )}
        </div>
        {message && (
          <div className="calendar-feedback" role="status">
            <span>{message}</span>
            {undo && (
              <button
                className="text-link"
                onClick={() => {
                  const current = data.events.find((e) => e.id === undo.after.id);
                  if (!current || !sameSlot(current, undo.after)) {
                    setMessage('Занятие уже изменилось. Отмена недоступна.');
                    setUndo(null);
                    return;
                  }
                  const restored = moveEvent(
                    current,
                    {
                      day: undo.before.day,
                      time: undo.before.time,
                      room: undo.before.room,
                      club: undo.before.club,
                    },
                    data.rooms,
                  );
                  const problem = validateEvent(restored, data.events, data.rooms);
                  if (problem) {
                    setMessage(problem);
                    return;
                  }
                  put('events', restored);
                  setDay(restored.day);
                  setRoom(restored.room);
                  setMessage('Перенос отменён. Прежнее время восстановлено.');
                  setUndo(null);
                }}
              >
                Отменить перенос
              </button>
            )}
            <button
              className="icon-button"
              aria-label="Скрыть сообщение"
              onClick={() => setMessage('')}
            >
              ×
            </button>
          </div>
        )}
        {view === 'Список' ? (
          <DataTable
            rows={[...events].sort((a, b) =>
              `${a.day}${a.time}`.localeCompare(`${b.day}${b.time}`),
            )}
            columns={[
              { key: 'day', label: 'Дата' },
              { key: 'time', label: 'Начало' },
              { key: 'name', label: 'Занятие' },
              { key: 'trainer', label: 'Тренер' },
              { key: 'room', label: 'Зал' },
              { key: 'booked', label: 'Записано' },
              { key: 'capacity', label: 'Мест' },
            ]}
            onOpen={show}
          />
        ) : columns.length ? (
          <div
            className="calendar-scroll"
            ref={scroller}
            style={{ maxHeight: `${available.height + available.heading}px` }}
          >
            <div
              className={`calendar-grid ${columns.length === 1 ? 'calendar-single' : ''}`}
              style={{ '--calendar-columns': columns.length } as CSSProperties}
            >
              <div className="calendar-time-heading">МСК</div>
              {columns.map((column) => (
                <div className="calendar-column-heading" key={column.key}>
                  <b>{column.label}</b>
                  <span>
                    {quantityLabel(
                      events.filter(
                        (e) => e.day === column.day && (!column.room || e.room === column.room),
                      ).length,
                      'training',
                    )}
                  </span>
                </div>
              ))}
              <div className="calendar-time-axis" style={{ height: gridHeight }}>
                {hours.map((time) => (
                  <span key={time} style={{ top: `${((time - start) / (end - start)) * 100}%` }}>
                    {clock(time)}
                  </span>
                ))}
              </div>
              {columns.map((column) => (
                <div
                  key={column.key}
                  className="calendar-column"
                  data-calendar-column={column.key}
                  data-day={column.day}
                  data-room={column.room}
                  style={{ height: gridHeight }}
                  tabIndex={0}
                  aria-label={`Время в расписании: ${column.label}`}
                  onContextMenu={(e) => {
                    if (e.target !== e.currentTarget) return;
                    e.preventDefault();
                    const rect = e.currentTarget.getBoundingClientRect();
                    setContext({
                      slot: seed(
                        slotAt(e.clientY, rect.top, rect.height, start, end, Number(step)),
                        column.room,
                        column.day,
                      ),
                      x: e.clientX,
                      y: e.clientY,
                    });
                  }}
                  onKeyDown={(e) => {
                    if (
                      e.target !== e.currentTarget ||
                      !(e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10'))
                    )
                      return;
                    e.preventDefault();
                    const rect = e.currentTarget.getBoundingClientRect();
                    setContext({
                      slot: seed(clock(start), column.room, column.day),
                      x: rect.left,
                      y: rect.top,
                    });
                  }}
                  onDoubleClick={(e) => {
                    if (e.target !== e.currentTarget) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    openLibrary(
                      seed(
                        slotAt(e.clientY, rect.top, rect.height, start, end, Number(step)),
                        column.room,
                        column.day,
                      ),
                    );
                  }}
                >
                  {hours.map((time) => (
                    <i
                      className="calendar-hour-line"
                      key={time}
                      style={{ top: `${((time - start) / (end - start)) * 100}%` }}
                    />
                  ))}
                  {layoutEvents(
                    events.filter(
                      (event) =>
                        event.day === column.day && (!column.room || event.room === column.room),
                    ),
                  ).map(({ event, lane, lanes }) => (
                    <button
                      key={event.id}
                      className={`calendar-event ${canEdit(event) ? 'is-editable' : 'is-readonly'} ${event.status === 'Отменено' ? 'is-cancelled' : ''} ${ghost?.id === event.id ? 'is-dragging' : ''}`}
                      style={
                        {
                          top: `${((minutes(event.time) - start) / (end - start)) * 100}%`,
                          height: `${(Number(event.duration) / (end - start)) * 100}%`,
                          left: `calc(${(lane / lanes) * 100}% + 3px)`,
                          width: `calc(${100 / lanes}% - 6px)`,
                          '--event-color': event.color || 'var(--color-accent)',
                        } as CSSProperties
                      }
                      aria-label={`${event.name}${event.kind === 'personal' ? ', ' + members.find((m) => String(m.id) === event.memberId)?.name : ''}, ${dayText(event.day)}, ${eventTime(event)}, ${event.trainer}, ${event.room}, записано ${event.booked} из ${event.capacity}${!canEdit(event) ? ', ' + event.status : ''}`}
                      title={`${eventTime(event)} · ${event.name}\n${event.trainer} · ${event.room}\n${event.booked} из ${event.capacity} мест. Нажмите для подробностей${canEdit(event) ? ' или перетащите для переноса' : ''}.`}
                      onPointerDown={(e) => startDrag(e, event)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setContext({
                          event,
                          slot: seed(event.time, event.room, event.day),
                          x: e.clientX,
                          y: e.clientY,
                        });
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
                          e.preventDefault();
                          const rect = e.currentTarget.getBoundingClientRect();
                          setContext({
                            event,
                            slot: seed(event.time, event.room, event.day),
                            x: rect.left,
                            y: rect.top,
                          });
                        }
                      }}
                      onPointerMove={onDrag}
                      onPointerUp={endDrag}
                      onPointerCancel={() => {
                        drag.current = null;
                        setGhost(null);
                        suppressClick.current = true;
                      }}
                      onClick={(e) => {
                        if (suppressClick.current && e.detail !== 0) {
                          suppressClick.current = false;
                          return;
                        }
                        if (event.status === 'Отменено')
                          openLibrary(seed(event.time, event.room, event.day));
                        else show(event);
                      }}
                    >
                      <time>{eventTime(event)}</time>
                      <strong>
                        {event.kind === 'personal'
                          ? `ПТ · ${members.find((m) => String(m.id) === event.memberId)?.name || 'Клиент'}`
                          : event.name}
                      </strong>
                      <span className="calendar-event-trainer">
                        {event.trainer}
                        {view === 'Неделя' && room === 'Все залы' ? ` · ${event.room}` : ''}
                      </span>
                      <span
                        className={`calendar-places ${event.kind !== 'personal' && Number(event.booked) >= Number(event.capacity) ? 'is-full' : ''}`}
                      >
                        <Users size={12} />
                        {event.kind === 'personal' ? (
                          '1 клиент'
                        ) : (
                          <>
                            {event.booked}/{event.capacity}
                          </>
                        )}
                      </span>
                    </button>
                  ))}
                  {ghost &&
                    ghost.day === column.day &&
                    (!column.room || ghost.room === column.room) && (
                      <div
                        className="calendar-drag-preview"
                        style={{
                          top: `${((minutes(ghost.time) - start) / (end - start)) * 100}%`,
                          height: `${(Number(ghost.duration) / (end - start)) * 100}%`,
                        }}
                      >
                        {eventTime(ghost)} · {ghost.name}
                      </div>
                    )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <Empty
            title="В этом клубе пока нет залов"
            text="Выберите другой клуб или добавьте зал в справочник."
            action={
              <Button variant="secondary" onClick={() => navigate('rooms')}>
                Справочник залов
              </Button>
            }
          />
        )}
        <footer className="calendar-footer">
          <span>
            <Move size={13} />
            Перетаскивание — с подтверждением
          </span>
          <span>Нажмите занятие для подробностей</span>
          <span>Двойной щелчок по свободному месту — добавить</span>
        </footer>
      </section>
    </div>
  );

  return (
    <>
      {fullscreen ? createPortal(content, document.body) : content}
      {createPortal(
        <>
          {deleting && (
            <Modal
              title="Удалить тренировку?"
              subtitle={`${dayText(deleting.day)} · ${eventTime(deleting)} · ${deleting.room}`}
              onClose={closeDelete}
            >
              <div className="ws-stack calendar-delete-summary">
                <h3>{deleting.name}</h3>
                <p>
                  Тренер: <strong>{deleting.trainer}</strong>
                </p>
                <Notice tone="warning">
                  Из расписания будет удалено только это занятие и записи на него. Записано
                  участников: {deleting.booked || '0'}. Абонементы клиентов сохранятся.
                </Notice>
                {error && (
                  <p role="alert" className="form-error">
                    {error}
                  </p>
                )}
                <div className="modal-actions">
                  <Button variant="secondary" onClick={closeDelete}>
                    Оставить тренировку
                  </Button>
                  <Button onClick={deleteTraining}>
                    <Trash2 size={17} />
                    Удалить тренировку
                  </Button>
                </div>
              </div>
            </Modal>
          )}
          {library && (
            <Modal
              title="База тренировок"
              subtitle="Выберите тренировку — её настройки заполнятся автоматически."
              onClose={closeLibrary}
            >
              <div className="ws-stack">
                <SearchBox value={query} onChange={setQuery} placeholder="Название или группа" />
                <div className="calendar-template-list">
                  {data['training-templates']
                    .filter(
                      (t) =>
                        t.status === 'Активен' &&
                        `${t.name} ${t.group}`
                          .toLocaleLowerCase('ru')
                          .includes(query.toLocaleLowerCase('ru')),
                    )
                    .map((template) => (
                      <button
                        className="calendar-template"
                        key={template.id}
                        onClick={() => applyTemplate(template)}
                      >
                        <i style={{ background: template.color }} />
                        <span>
                          <strong>{template.name}</strong>
                          <small>
                            {template.duration} мин · {template.group} ·{' '}
                            {template.trainer || 'Тренер не указан'}
                          </small>
                          <small>
                            {template.room || 'Текущий зал'} ·{' '}
                            {template.capacityMode === 'Своя вместимость'
                              ? `${template.capacity} мест`
                              : 'Вместимость зала'}{' '}
                            · {template.payment}
                          </small>
                        </span>
                        <Plus size={18} />
                      </button>
                    ))}
                </div>
                {!data['training-templates'].some(
                  (t) =>
                    t.status === 'Активен' &&
                    `${t.name} ${t.group}`
                      .toLocaleLowerCase('ru')
                      .includes(query.toLocaleLowerCase('ru')),
                ) && <Empty text="Попробуйте другое название или добавьте шаблон в базу." />}
                <Button
                  variant="secondary"
                  onClick={() => {
                    setLibrary(null);
                    setFullscreen(false);
                    navigate('training-templates');
                  }}
                >
                  <BookOpen size={15} />
                  Управлять базой тренировок
                </Button>
              </div>
            </Modal>
          )}
          {editing && editing.kind === 'personal' && (
            <PersonalTrainingForm
              key={editing.id}
              initial={editing}
              user={user}
              members={members}
              onClose={closeEditing}
              onSave={saveRecord}
            />
          )}
          {editing && editing.kind !== 'personal' && (
            <EventForm
              key={editing.id}
              initial={editing}
              templates={data['training-templates']}
              rooms={data.rooms}
              trainers={trainers}
              onClose={closeEditing}
              onSave={saveRecord}
            />
          )}
          {pending && (
            <Modal
              title="Перенести занятие?"
              subtitle={`${pending.after.kind === 'personal' ? members.find((m) => String(m.id) === pending.after.memberId)?.name || 'Клиент' : pending.after.name} · ${pending.after.trainer}`}
              onClose={closePending}
            >
              <div className="calendar-move-summary">
                <div>
                  <small>Сейчас</small>
                  <strong>{dayText(pending.before.day)}</strong>
                  <b>{eventTime(pending.before)}</b>
                  <span>
                    {pending.before.room} · {pending.before.club}
                  </span>
                </div>
                <ArrowRight size={20} />
                <div>
                  <small>После переноса</small>
                  <strong>{dayText(pending.after.day)}</strong>
                  <b>{eventTime(pending.after)}</b>
                  <span>
                    {pending.after.room} · {pending.after.club}
                  </span>
                </div>
              </div>
              <p className="calendar-dialog-note">
                Записи участников сохранятся. До подтверждения расписание не изменится.
              </p>
              {(error || validateEvent(pending.after, data.events, data.rooms)) && (
                <Notice tone="warning">
                  {error || validateEvent(pending.after, data.events, data.rooms)}
                </Notice>
              )}
              <div className="modal-actions">
                <Button variant="secondary" onClick={closePending}>
                  Оставить как было
                </Button>
                <Button
                  onClick={finishMove}
                  disabled={Boolean(validateEvent(pending.after, data.events, data.rooms))}
                >
                  Подтвердить перенос
                </Button>
              </div>
            </Modal>
          )}
          {opened && (
            <Modal
              title={
                opened.kind === 'personal'
                  ? `ПТ · ${members.find((m) => String(m.id) === opened.memberId)?.name || 'Клиент'}`
                  : opened.name
              }
              subtitle={`${dayText(opened.day)} · ${eventTime(opened)} · ${opened.room}`}
              onClose={closeDetails}
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
                {opened.description && <p>{opened.description}</p>}
                <Status>{opened.status}</Status>
                {opened.status === 'Отменено' && (
                  <Button
                    onClick={() => {
                      const initial = seed(opened.time, opened.room, opened.day);
                      closeDetails();
                      openLibrary(initial);
                    }}
                  >
                    <Plus size={16} />
                    Добавить тренировку на это время
                  </Button>
                )}
                {isTrainer && opened.kind !== 'personal' && (
                  <Notice>Групповое занятие доступно тренеру только для просмотра.</Notice>
                )}
                {isTrainer && opened.kind === 'personal' && (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      const member = members.find((m) => String(m.id) === opened.memberId);
                      closeDetails();
                      setFullscreen(false);
                      navigate('trainer-clients', member);
                    }}
                  >
                    Заметки о клиенте
                  </Button>
                )}
                {canEdit(opened) && (
                  <>
                    <div className="ws-actions">
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setEditing({ ...opened });
                          closeDetails();
                        }}
                      >
                        <Move size={15} />
                        Перенести / изменить
                      </Button>
                      <Button
                        variant="secondary"
                        className="calendar-delete-action"
                        onClick={() => requestDelete(opened)}
                      >
                        <Trash2 size={17} />
                        Удалить тренировку
                      </Button>
                    </div>
                    {user.role === 'administrator' && opened.kind !== 'personal' && (
                      <>
                        <label className="form-field">
                          <span>Клиент для записи</span>
                          <Select value={booking} onChange={(e) => setBooking(e.target.value)}>
                            <option value="">Выберите клиента</option>
                            {members.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name}
                              </option>
                            ))}
                          </Select>
                        </label>
                        <Button
                          disabled={
                            !booking ||
                            (opened.attendees || '').split(',').includes(booking) ||
                            Number(opened.booked) >= Number(opened.capacity)
                          }
                          onClick={() => {
                            const next = {
                              ...opened,
                              booked: String(Number(opened.booked) + 1),
                              status:
                                Number(opened.booked) + 1 >= Number(opened.capacity)
                                  ? 'Мест нет'
                                  : 'Запись открыта',
                              attendees: [opened.attendees, booking].filter(Boolean).join(','),
                            };
                            put('events', next);
                            setBooking('');
                            setMessage('Клиент записан на занятие.');
                          }}
                        >
                          Записать клиента
                        </Button>
                        {Number(opened.booked) >= Number(opened.capacity) && (
                          <Notice tone="warning">
                            Все места заняты. Правила работы листа ожидания требуют уточнения.
                          </Notice>
                        )}
                        {opened.attendees
                          ?.split(',')
                          .filter(Boolean)
                          .map((id) => (
                            <div className="ws-list-line" key={id}>
                              <span>
                                {members.find((m) => String(m.id) === id)?.name || 'Клиент'}
                              </span>
                              <Button
                                variant="ghost"
                                onClick={() =>
                                  put('events', {
                                    ...opened,
                                    booked: String(Math.max(0, Number(opened.booked) - 1)),
                                    status: 'Запись открыта',
                                    attendees: opened.attendees
                                      .split(',')
                                      .filter((value) => value !== id)
                                      .join(','),
                                  })
                                }
                              >
                                Снять запись
                              </Button>
                            </div>
                          ))}
                      </>
                    )}
                    <details className="ws-disclosure">
                      <summary>Другие действия</summary>
                      <Button
                        variant="ghost"
                        onClick={() => put('events', { ...opened, status: 'Отменено' })}
                      >
                        Отменить это демозанятие
                      </Button>
                    </details>
                  </>
                )}
              </div>
            </Modal>
          )}
          {copying && (
            <Modal
              title="Добавить занятия из прошлой недели?"
              subtitle="Только для выбранного клуба. Записи участников не копируются."
              onClose={closeCopy}
            >
              <p>
                {dayText(addDays(week, -7))} — {dayText(addDays(week, -1))} → {dayText(week)} —{' '}
                {dayText(addDays(week, 6))}
              </p>
              <p>
                Существующие занятия сохранятся. Занятия с пересечениями по залу или тренеру будут
                пропущены.
              </p>
              <div className="modal-actions">
                <Button variant="secondary" onClick={closeCopy}>
                  Отмена
                </Button>
                <Button
                  onClick={() => {
                    const existing = [...data.events];
                    let added = 0;
                    let skipped = 0;
                    data.events
                      .filter(
                        (e) =>
                          e.club === club &&
                          e.day >= addDays(week, -7) &&
                          e.day < week &&
                          e.status !== 'Отменено',
                      )
                      .forEach((event) => {
                        const next = {
                          ...event,
                          id: demoId('event'),
                          day: addDays(event.day, 7),
                          booked: '0',
                          attendees: '',
                          status: 'Запись открыта',
                        };
                        if (validateEvent(next, existing, data.rooms)) {
                          skipped++;
                          return;
                        }
                        existing.push(next);
                        put('events', next);
                        added++;
                      });
                    setCopying(false);
                    setMessage(
                      `Добавлено занятий: ${added}. Пропущено с пересечениями: ${skipped}.`,
                    );
                  }}
                >
                  Добавить занятия
                </Button>
              </div>
            </Modal>
          )}
        </>,
        document.body,
      )}
    </>
  );
}

function EventForm({
  initial,
  templates,
  rooms,
  trainers,
  onClose,
  onSave,
}: {
  initial: DemoRecord;
  templates: DemoRecord[];
  rooms: DemoRecord[];
  trainers: string[];
  onClose: () => void;
  onSave: (record: DemoRecord) => string | void;
}) {
  const [draft, setDraft] = useState<DemoRecord>({
    format: 'Групповое',
    payment: 'Включено в абонемент',
    capacityMode: 'По залу',
    minimum: '3',
    booking: 'Обычная запись',
    seats: 'Не требуется',
    waitlist: 'Включён',
    ...initial,
  });
  const [error, setError] = useState('');
  const update = (key: string, value: string) => {
    setDraft((d) => {
      const next = { ...d, [key]: value };
      if (key === 'capacity') next.capacityMode = 'Своя вместимость';
      if (key === 'capacityMode' && value === 'По залу') {
        next.capacity =
          rooms.find((r) => r.club === d.club && r.name === d.room)?.capacity || d.capacity;
      }
      return next;
    });
    setError('');
  };
  const field = (
    key: string,
    label: string,
    type = 'text',
    options?: string[],
    required = true,
  ) => (
    <label className="form-field" key={key}>
      <span>
        {label}
        {required ? ' *' : ''}
      </span>
      {options ? (
        <Select
          name={key}
          value={draft[key] || ''}
          required={required}
          onChange={(e) => update(key, e.target.value)}
        >
          <option value="">Выберите</option>
          {options.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </Select>
      ) : type === 'textarea' ? (
        <textarea
          name={key}
          value={draft[key] || ''}
          onChange={(e) => update(key, e.target.value)}
          rows={3}
        />
      ) : (
        <input
          name={key}
          value={draft[key] || ''}
          type={type}
          required={required}
          min={type === 'number' ? (key === 'minimum' ? 0 : key === 'duration' ? 5 : 1) : undefined}
          step={type === 'number' ? 1 : undefined}
          onInput={(e) => update(key, e.currentTarget.value)}
          onChange={(e) => update(key, e.target.value)}
        />
      )}
    </label>
  );
  return (
    <Modal
      title="Занятие в расписании"
      subtitle="Настройки взяты из базы. Их можно изменить только для этого занятия."
      onClose={onClose}
    >
      <form
        className="ws-stack"
        onSubmit={(e) => {
          e.preventDefault();
          const values = Object.fromEntries(new FormData(e.currentTarget)) as Record<
            string,
            string
          >;
          const problem = onSave({ ...draft, ...values });
          if (problem) setError(problem);
        }}
      >
        <label className="form-field">
          <span>Шаблон тренировки</span>
          <Select
            value={draft.templateId || ''}
            onChange={(e) => {
              const template = templates.find((t) => t.id === e.target.value);
              if (template) setDraft(templateEvent(template, draft, rooms, trainers[0] || ''));
            }}
          >
            <option value="">Своё занятие</option>
            {templates
              .filter((t) => t.status === 'Активен')
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
          </Select>
        </label>
        {field('name', 'Название')}
        <div className="calendar-form-grid">
          {field('day', 'Дата', 'date')}
          {field('time', 'Начало', 'time')}
          {field('duration', 'Длительность, мин', 'number')}
          {field('trainer', 'Тренер', 'text', trainers)}
          <label className="form-field">
            <span>Клуб *</span>
            <Select
              name="club"
              value={draft.club}
              onChange={(e) => {
                const room = rooms.find(
                  (r) => r.club === e.target.value && r.status !== 'В архиве',
                );
                setDraft((d) => ({
                  ...d,
                  club: e.target.value,
                  room: room?.name || '',
                  capacity: room?.capacity || '1',
                }));
              }}
            >
              <option>Центральный</option>
              <option>Парк</option>
              <option>Речной</option>
            </Select>
          </label>
          <label className="form-field">
            <span>Зал *</span>
            <Select
              name="room"
              value={draft.room}
              required
              onChange={(e) => {
                const room = rooms.find((r) => r.club === draft.club && r.name === e.target.value);
                setDraft((d) => ({
                  ...d,
                  room: e.target.value,
                  capacity:
                    d.capacityMode === 'Своя вместимость'
                      ? String(Math.min(Number(d.capacity), Number(room?.capacity)))
                      : room?.capacity || '1',
                }));
              }}
            >
              <option value="">Выберите</option>
              {rooms
                .filter((r) => r.club === draft.club && r.status !== 'В архиве')
                .map((r) => (
                  <option key={r.id}>{r.name}</option>
                ))}
            </Select>
          </label>
          {field('capacity', 'Количество мест', 'number')}
          {field('color', 'Цвет отметки', 'color')}
        </div>
        <details className="ws-disclosure">
          <summary>Условия записи и описание</summary>
          <div className="calendar-form-grid">
            {field('format', 'Формат', 'text', ['Групповое', 'Персональное'])}
            {field('payment', 'Оплата', 'text', ['Включено в абонемент', 'Дополнительная оплата'])}
            {field('capacityMode', 'Вместимость', 'text', ['По залу', 'Своя вместимость'])}
            {field('minimum', 'Минимум участников', 'number', undefined, false)}
            {field('booking', 'Способ записи', 'text', ['Обычная запись', 'По приглашению'])}
            {field('seats', 'Выбор места', 'text', ['Не требуется', 'По схеме зала'])}
            {field('waitlist', 'Лист ожидания', 'text', ['Выключен', 'Включён'])}
          </div>
          {field('description', 'Описание', 'textarea', undefined, false)}
        </details>
        {error && <Notice tone="warning">{error}</Notice>}
        <div className="modal-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit">Сохранить занятие</Button>
        </div>
      </form>
    </Modal>
  );
}
