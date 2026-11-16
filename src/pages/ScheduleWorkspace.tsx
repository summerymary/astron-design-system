import { demoClubs } from '../data/roles';
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
import { Button, ConfirmDialog, CountBadge, Modal } from '../components/ui';
import { ScheduleAttendees } from '../components/ScheduleAttendees';
import { ScheduleDayBoard } from '../components/ScheduleDayBoard';
import { clientName } from '../lib/client-display';
import { DataTable, Empty, Notice, SearchBox, Status, Tabs } from '../components/WorkspaceUI';
import type { Navigate } from '../components/WorkspaceUI';
import { demoId, useWorkspace } from '../components/WorkspaceProvider';
import { TODAY } from '../data/workspace';
import type { DemoRecord } from '../data/workspace';
import type { DemoUser, Member, RegisterVisit } from '../types';
import { PersonalTrainingForm, personalDraft } from './StaffWorkspace';
import {
  canManageEvent,
  canCreateEvent,
  canCancelEvent,
  canCopySchedule,
  canDeleteEvent,
  isManagementRole,
  personalScopeError,
} from '../lib/staff-rules';
import {
  OCCUPANCY_SCALE,
  eventOccupancy,
  occupancySummary,
  TRAINING_INTENSITIES,
  trainingIntensity,
  addDays,
  calendarTimeline,
  calendarGeometry,
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
import { ScheduleCopyDialog } from '../components/ScheduleCopyDialog';
import { planWeekCopy } from '../lib/schedule-copy';
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
  onRegister,
  navigate,
  clubName,
  onClubChange,
  user,
  onMember,
  recordId,
  onRecord,
}: {
  members: Member[];
  onRegister: RegisterVisit;
  navigate: Navigate;
  clubName: string;
  onClubChange: (club: string) => void;
  user: DemoUser;
  onMember: (member: Member) => void;
  recordId?: string | null;
  onRecord?: (id: string | null) => void;
}) {
  const { data, put, remove } = useWorkspace();
  const isTrainer = user.role === 'trainer';
  const isAdmin = user.role === 'administrator';
  const isDirector = [
    'club-director',
    'network-director',
    'fitness-director',
    'operations-director',
  ].includes(user.role);
  const [colorMode, setColorMode] = useState('Заполняемость');
  const heatmap = isDirector && colorMode === 'Заполняемость';
  const canCreate = canCreateEvent(user);
  const [scheduleClub, setScheduleClub] = useState(
    clubName.split(' \u00b7 ').at(-1) ||
      '\u0426\u0435\u043d\u0442\u0440\u0430\u043b\u044c\u043d\u044b\u0439',
  );
  const canEdit = (event: DemoRecord) => canManageEvent(event, user);
  const canDelete = (event: DemoRecord) => canDeleteEvent(event, user);
  const canCopy = canCopySchedule(user);
  const club = isAdmin ? scheduleClub : clubName.split(' \u00b7 ').at(-1)!;
  const setClub = isAdmin ? setScheduleClub : onClubChange;
  const saved =
    data['calendar-view']?.find((r) => r.id === `${user.id}:${club}`) ||
    data['calendar-view']?.find((r) => r.id === user.id && r.club === club);
  const [day, setDay] = useState(saved?.day || TODAY);
  const [viewPreference, setView] = useState(saved?.view || 'День');
  const view = heatmap ? 'Неделя' : viewPreference;
  const [room, setRoom] = useState(saved?.room || 'Все залы');
  const [trainer, setTrainer] = useState(isTrainer ? user.name : saved?.trainer || 'Все тренеры');
  const [scale, setScale] = useState(saved?.scale || 'Весь день');
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
  const [cancelling, setCancelling] = useState<DemoRecord | null>(null);
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
  const [available, setAvailable] = useState({ height: 580, width: 900, heading: 40, inset: 2 });
  const root = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const fullscreenTrigger = useRef<HTMLButtonElement>(null);
  const wasFullscreen = useRef(false);
  const drag = useRef<Drag | null>(null);
  const suppressClick = useRef(false);
  const dialog = Boolean(
    openedId ||
    editing ||
    library ||
    pending ||
    deleting ||
    copying ||
    context ||
    cancelling ||
    filtersOpen,
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
  const openWeekCopy = () => {
    if (!canCopy) return;
    setCopying(true);
    setError('');
  };
  const applyWeekCopy = (copySource: string) => {
    if (!canCopy) return;
    const current = planWeekCopy(data.events, data.rooms, club, copySource, week);
    const ready = current.items.filter((item) => !item.reason);
    if (current.error || !ready.length) return;
    ready.forEach((item) => put('events', { ...item.record, id: demoId('event') }));
    closeCopy();
    setMessage(
      `Добавлено занятий: ${ready.length}. Пропущено: ${current.items.length - ready.length}. ${dayText(week)} — ${dayText(addDays(week, 6))}.`,
    );
  };
  const dates = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  const rangeEvents = data.events.filter(
    (e) => e.club === club && (view === 'Неделя' ? dates.includes(e.day) : e.day === day),
  );
  const events = rangeEvents.filter(
    (e) =>
      (!isTrainer || e.trainer === user.name) &&
      (room === 'Все залы' || e.room === room) &&
      (trainer === 'Все тренеры' || e.trainer === trainer),
  );
  const occupancy = occupancySummary(events);
  const participantName = (id: string) => {
    const member = members.find((m) => String(m.id) === id);
    return member ? clientName(member) : 'Клиент';
  };
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
  const timeline = calendarTimeline(isAdmin ? events : rangeEvents, isAdmin);
  const { start, end } = timeline;
  const { height: gridHeight, hourStep } = calendarGeometry(
    isAdmin ? events : rangeEvents,
    scale,
    available.height,
    view === 'Неделя',
    timeline.duration,
  );
  const hours = timeline.hours;
  const axisHours = hours
    .filter((_, i) => i % hourStep === 0 || i === hours.length - 1)
    .filter(
      (time, i, labels) =>
        i === 0 ||
        i === labels.length - 1 ||
        ((100 - timeline.position(time)) / 100) * gridHeight >= 26,
    );
  const closeDetails = useCallback(() => {
    setOpenedId('');
    onRecord?.(null);
  }, [onRecord]);
  useEffect(() => {
    if (!recordId) return;
    const event = data.events.find((item) => item.id === recordId);
    if (!event || (isTrainer && event.trainer !== user.name)) return;
    setClub(event.club);
    setDay(event.day);
    setRoom(event.room);
    setOpenedId(event.id);
    // The URL target is a navigation request; later event updates remain live in the modal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordId, user.id]);
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
    put('calendar-view', {
      id: `${user.id}:${club}`,
      day,
      view: viewPreference,
      club,
      room,
      trainer,
      scale,
      step,
    });
    // put is intentionally not a dependency: provider creates it on every update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day, viewPreference, club, room, trainer, scale, step]);
  useLayoutEffect(() => {
    const measure = () => {
      if (!scroller.current || !root.current) return;
      const rect = scroller.current.getBoundingClientRect();
      const workspace = root.current.closest('.workspace-page-body');
      const viewportBottom = Math.min(
        window.innerHeight,
        workspace?.getBoundingClientRect().bottom || window.innerHeight,
      );
      const heading = Math.max(
        ...Array.from(
          root.current.querySelectorAll(
            '.calendar-time-heading, .calendar-column-heading, .schedule-day-board thead',
          ),
        ).map((el) => el.getBoundingClientRect().height),
        0,
      );
      const footer =
        root.current.querySelector('.calendar-footer')?.getBoundingClientRect().height || 0;
      const legend =
        root.current
          .querySelector('.calendar-occupancy-legend, .calendar-intensity-legend')
          ?.getBoundingClientRect().height || 0;
      const scrollbar = scroller.current.offsetHeight - scroller.current.clientHeight;
      const remaining =
        viewportBottom - rect.top - heading - footer - legend - scrollbar - (fullscreen ? 16 : 6);
      // On phones the page may scroll, but the calendar still shows the complete day.
      const height = Math.max(
        !fullscreen && root.current.clientWidth < 700 ? 420 : 100,
        Math.floor(remaining),
      );
      const next = { height, width: root.current.clientWidth, heading, inset: scrollbar };
      setAvailable((previous) =>
        previous.height === next.height &&
        previous.width === next.width &&
        previous.heading === next.heading &&
        previous.inset === next.inset
          ? previous
          : next,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (root.current) observer.observe(root.current);
    const panel = root.current?.querySelector('.calendar-panel');
    if (panel) observer.observe(panel);
    for (const el of root.current?.querySelectorAll(
      '.calendar-controls, .calendar-toolbar, .calendar-filters, .calendar-footer, .calendar-color-mode, .calendar-occupancy-legend, .calendar-intensity-legend',
    ) || [])
      observer.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [fullscreen, view, heatmap, filtersOpen, message, columns.length]);
  useEffect(() => {
    if (wasFullscreen.current && !fullscreen) fullscreenTrigger.current?.focus();
    wasFullscreen.current = fullscreen;
  }, [fullscreen]);
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
    if (!canDelete(event)) return;
    setDeleting({ ...event });
    setContext(null);
    closeDetails();
    setError('');
  };
  const deleteTraining = () => {
    if (!deleting) return;
    const current = data.events.find((event) => event.id === deleting.id);
    if (!current || !canDelete(current)) {
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
    if (!canCreate) return;
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
    if (!canEdit(before)) return;
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
    if (!canCreate)
      return '\u042d\u0442\u0430 \u0440\u043e\u043b\u044c \u043d\u0435 \u0434\u043e\u0431\u0430\u0432\u043b\u044f\u0435\u0442 \u0438 \u043d\u0435 \u043f\u0435\u0440\u0435\u043d\u043e\u0441\u0438\u0442 \u0442\u0440\u0435\u043d\u0438\u0440\u043e\u0432\u043a\u0438.';
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

  const changedFilters =
    Number(room !== 'Все залы') + Number(trainer !== 'Все тренеры') + Number(scale !== 'Весь день');
  const filterToggle = (
    <Button
      variant="secondary"
      className={`calendar-filter-toggle ${isAdmin ? 'calendar-admin-filter-toggle' : ''}`}
      aria-label="Фильтры расписания"
      aria-expanded={filtersOpen}
      aria-haspopup="dialog"
      aria-describedby={isAdmin ? 'calendar-hours-note' : undefined}
      title={`${club} · ${room} · ${trainer} · ${scale}`}
      onClick={() => setFiltersOpen(!filtersOpen)}
    >
      <Settings2 size={18} />
      <span className="calendar-filter-summary">
        {isAdmin ? `${club} · ${room}` : `${room} · ${scale}`}
      </span>
      {isAdmin && changedFilters > 0 && (
        <span className="calendar-filter-count" title={`Изменено фильтров: ${changedFilters}`}>
          <CountBadge>{changedFilters}</CountBadge>
        </span>
      )}
      {!isAdmin && <b>{events.length}</b>}
      <ChevronRight size={16} className={filtersOpen ? 'is-open' : ''} />
    </Button>
  );
  const content = (
    <div
      ref={root}
      className={`calendar-workspace ${isAdmin ? 'calendar-is-admin' : ''} ${isTrainer ? 'calendar-is-trainer' : ''} calendar-scale-${scale === 'Весь день' ? 'fit' : scale === 'Крупнее' ? 'large' : 'comfortable'} ${fullscreen ? 'calendar-fullscreen' : ''} ${view !== 'Список' && gridHeight > available.height ? 'calendar-needs-scroll' : ''}`}
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
              {context.event && canCancelEvent(context.event, user) && (
                <button
                  role="menuitem"
                  className="calendar-delete-action"
                  onClick={() => {
                    setCancelling(context.event!);
                    setContext(null);
                  }}
                >
                  Отменить занятие
                </button>
              )}
              {canCreate && (
                <button
                  role="menuitem"
                  onClick={() => {
                    openLibrary(context.slot);
                    setContext(null);
                  }}
                >
                  Добавить тренировку{context.event?.status === 'Отменено' ? ' на это время' : ''}
                </button>
              )}
              {context.event && canDelete(context.event) && (
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
      {fullscreen && (
        <div className="calendar-fullscreen-heading">
          <strong>Расписание · {dayText(day)}</strong>
          <Button variant="secondary" onClick={() => setFullscreen(false)} autoFocus>
            <Minimize2 size={18} /> Закрыть полный экран
          </Button>
        </div>
      )}
      {filtersOpen && (
        <Modal title="Фильтры расписания" onClose={() => setFiltersOpen(false)}>
          <div className="schedule-filter-form">
            <label className="form-field">
              <span>Клуб расписания</span>
              <Select
                value={club}
                disabled={isTrainer}
                onChange={(e) => {
                  setClub(e.target.value);
                  setRoom('Все залы');
                  setTrainer(isTrainer ? user.name : 'Все тренеры');
                }}
              >
                {demoClubs
                  .filter((item) => isAdmin || user.clubIds.includes(item.id))
                  .map((item) => (
                    <option key={item.id}>{item.shortName}</option>
                  ))}
              </Select>
            </label>
            <label className="form-field">
              <span>Зал</span>
              <Select value={room} onChange={(e) => setRoom(e.target.value)}>
                <option>Все залы</option>
                {activeRooms.map((r) => (
                  <option key={r.id}>{r.name}</option>
                ))}
              </Select>
            </label>
            <label className="form-field">
              <span>Тренер</span>
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
            {view !== 'Список' && (
              <label className="form-field">
                <span>Размер занятий</span>
                <Select value={scale} onChange={(e) => setScale(e.target.value)}>
                  <option>Весь день</option>
                  <option>Комфортно</option>
                  <option>Крупнее</option>
                </Select>
              </label>
            )}
            {canCreate && !isTrainer && (
              <label className="form-field">
                <span>Шаг переноса</span>
                <Select value={step} onChange={(e) => setStep(e.target.value)}>
                  <option value="5">5 минут</option>
                  <option value="15">15 минут</option>
                  <option value="30">30 минут</option>
                </Select>
              </label>
            )}
          </div>
          {canCreate && !isTrainer && (
            <div className="ws-actions">
              <Button variant="ghost" onClick={() => navigate('schedule-calendar')}>
                Настройки календаря
              </Button>
              <Button variant="ghost" onClick={() => navigate('training-groups')}>
                Группы тренировок
              </Button>
            </div>
          )}
          <div className="modal-actions">
            <Button
              variant="secondary"
              onClick={() => {
                setRoom('Все залы');
                setTrainer(isTrainer ? user.name : 'Все тренеры');
                setScale('Весь день');
              }}
            >
              Сбросить фильтры
            </Button>
            <Button onClick={() => setFiltersOpen(false)}>Показать {events.length} занятий</Button>
          </div>
        </Modal>
      )}
      <section className={`calendar-panel panel ${heatmap ? 'calendar-heatmap' : ''}`}>
        <div
          className="calendar-controls"
          onKeyDown={
            isAdmin
              ? (event) => {
                  if (event.key === 'Escape' && filtersOpen && !event.defaultPrevented) {
                    event.preventDefault();
                    event.stopPropagation();
                    setFiltersOpen(false);
                    root.current
                      ?.querySelector<HTMLButtonElement>('.calendar-filter-toggle')
                      ?.focus();
                  }
                }
              : undefined
          }
        >
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
            {heatmap ? (
              <strong className="calendar-week-label">
                Неделя · {dayText(week)} — {dayText(dates[6])}
              </strong>
            ) : (
              <Tabs
                items={['День', 'Неделя', 'Список']}
                value={view}
                onChange={setView}
                label="Вид расписания"
                variant="segmented"
              />
            )}
            {isAdmin && filterToggle}
            <div className="calendar-create">
              {canCopy && (
                <Button variant="secondary" onClick={openWeekCopy}>
                  <Copy size={16} />
                  Копировать неделю
                </Button>
              )}
              {canCreate && (
                <>
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
                </>
              )}
              {!fullscreen && (
                <button
                  className="icon-button"
                  ref={fullscreenTrigger}
                  aria-label="Расписание на весь экран"
                  title="Весь экран — все занятия перед глазами"
                  onClick={() => setFullscreen(!fullscreen)}
                >
                  <Maximize2 size={18} />
                </button>
              )}
            </div>
          </div>
          {view !== 'Неделя' && (
            <div className="calendar-week-strip" id="calendar-week-strip" aria-label="Дни недели">
              {dates.map((date) => (
                <button
                  key={date}
                  aria-pressed={date === day}
                  onClick={() => {
                    setDay(date);
                    if (isAdmin) setFiltersOpen(false);
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
          )}
          {!isAdmin && filterToggle}
          {isAdmin && (
            <span className="sr-only" id="calendar-hours-note">
              Изменено фильтров: {changedFilters}. {trainer}. {scale}. Пустые часы скрыты.
              Дополнительные параметры доступны в фильтрах расписания.
            </span>
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
        {isDirector && (
          <div className="calendar-color-mode">
            <Tabs
              items={['Заполняемость', 'Интенсивность']}
              value={colorMode}
              onChange={setColorMode}
              label="Цвет занятий"
            />
            {heatmap && (
              <p>
                Заполненность:{' '}
                <strong>{occupancy.percent === null ? '—' : occupancy.percent + '%'}</strong>
                <span>
                  Записано {occupancy.booked} из {occupancy.capacity} мест · отменённые не
                  учитываются
                </span>
              </p>
            )}
          </div>
        )}
        {isAdmin && view === 'День' && events.length && columns.length ? (
          <div
            className="calendar-scroll schedule-day-scroll"
            ref={scroller}
            tabIndex={0}
            aria-label="Расписание на день по времени начала"
            style={{ height: `${available.height + available.heading + available.inset}px` }}
          >
            <ScheduleDayBoard
              events={events}
              height={
                scale === 'Весь день'
                  ? available.height
                  : Math.max(1, new Set(events.map((event) => event.time)).size) *
                    (scale === 'Крупнее' ? 72 : 56)
              }
              rooms={columns}
              onOpen={show}
              onContext={(event, x, y) =>
                setContext({ event, slot: seed(event.time, event.room, event.day), x, y })
              }
            />
          </div>
        ) : view === 'Список' ? (
          <DataTable
            rows={[...events]
              .map((event): DemoRecord => ({ ...event, occupancy: eventOccupancy(event).label }))
              .sort((a, b) => `${a.day}${a.time}`.localeCompare(`${b.day}${b.time}`))}
            columns={[
              { key: 'day', label: 'Дата' },
              { key: 'time', label: 'Начало' },
              { key: 'name', label: 'Занятие' },
              { key: 'trainer', label: 'Тренер' },
              { key: 'room', label: 'Зал' },
              { key: 'booked', label: 'Записано' },
              { key: 'capacity', label: 'Мест' },
              { key: 'status', label: 'Состояние' },
              ...(heatmap ? [{ key: 'occupancy', label: 'Заполняемость' }] : []),
            ]}
            onOpen={show}
          />
        ) : columns.length && (!isAdmin || events.length > 0) ? (
          <div
            className="calendar-scroll"
            ref={scroller}
            style={{ height: `${available.height + available.heading + available.inset}px` }}
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
                {axisHours.map((time) => (
                  <span key={time} style={{ top: `${timeline.position(time)}%` }}>
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
                    if (!canCreate) return;
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
                      !canCreate ||
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
                    if (e.target !== e.currentTarget || !canCreate) return;
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
                  {hours
                    .filter((time) => time < end)
                    .map((time) => (
                      <i
                        className="calendar-hour-line"
                        key={time}
                        style={{ top: `${timeline.position(time)}%` }}
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
                      className={`calendar-event ${canEdit(event) ? 'is-editable' : 'is-readonly'} ${event.status === 'Отменено' ? 'is-cancelled' : ''} ${ghost?.id === event.id ? 'is-dragging' : ''} ${scale === 'Весь день' && (timeline.size(minutes(event.time), Number(event.duration)) / 100) * gridHeight < 23 ? 'is-compact' : ''} ${(available.width - 56) / columns.length / lanes < 360 ? 'is-narrow' : ''} ${(available.width - 56) / columns.length / lanes < 250 ? 'is-title-only' : ''}`}
                      style={
                        {
                          top: `${timeline.position(minutes(event.time))}%`,
                          height: `${timeline.size(minutes(event.time), Number(event.duration))}%`,
                          left: `calc(${(lane / lanes) * 100}% + 3px)`,
                          width: `calc(${100 / lanes}% - 6px)`,
                          '--event-color': heatmap
                            ? eventOccupancy(event).line
                            : trainingIntensity(event).color,
                          '--event-background': eventOccupancy(event).background,
                          '--event-foreground': eventOccupancy(event).foreground,
                        } as CSSProperties
                      }
                      data-intensity={trainingIntensity(event).value}
                      aria-label={`${heatmap ? 'Заполняемость ' + eventOccupancy(event).label : trainingIntensity(event).label}, ${event.name}${event.kind === 'personal' ? ', ' + participantName(event.memberId) : ''}, ${dayText(event.day)}, ${eventTime(event)}, ${event.trainer}, ${event.room}, записано ${event.booked} из ${event.capacity}${!canEdit(event) ? ', ' + event.status : ''}`}
                      title={`${eventTime(event)} · ${event.name} · ${heatmap ? 'Заполняемость ' + eventOccupancy(event).label : trainingIntensity(event).label}\n${event.trainer} · ${event.room}\n${event.booked} из ${event.capacity} мест. Нажмите для подробностей${canEdit(event) ? ' или перетащите для переноса' : ''}.`}
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
                        if (event.status === 'Отменено' && canCreate)
                          openLibrary(seed(event.time, event.room, event.day));
                        else show(event);
                      }}
                    >
                      <strong>
                        {event.kind === 'personal'
                          ? `ПТ · ${participantName(event.memberId)}`
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
                        {heatmap ? (
                          <>
                            {eventOccupancy(event).label}
                            {event.status !== 'Отменено' && lanes === 1 && (
                              <>
                                {' '}
                                · {event.booked}/{event.capacity}
                              </>
                            )}
                          </>
                        ) : event.kind === 'personal' ? (
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
                          top: `${timeline.position(minutes(ghost.time))}%`,
                          height: `${timeline.size(minutes(ghost.time), Number(ghost.duration))}%`,
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
            title={
              columns.length ? 'Нет занятий по выбранным условиям' : 'В этом клубе пока нет залов'
            }
            text={
              columns.length
                ? 'Выберите другую дату, зал или тренера. Пустые часы скрыты.'
                : 'Выберите другой клуб или добавьте зал в справочник.'
            }
            action={
              !columns.length && (
                <Button variant="secondary" onClick={() => navigate('rooms')}>
                  Справочник залов
                </Button>
              )
            }
          />
        )}
        {view !== 'Список' &&
          (heatmap ? (
            <div className="calendar-occupancy-legend" aria-label="Шкала заполняемости">
              <span>Меньше записей</span>
              {OCCUPANCY_SCALE.map((item) => (
                <span key={item.min}>
                  <i style={{ background: item.background, borderColor: item.line }} />
                  {item.label}
                </span>
              ))}
              <span>Больше записей</span>
            </div>
          ) : (
            <div className="calendar-intensity-legend" aria-label="Цвета интенсивности занятий">
              {TRAINING_INTENSITIES.map((item) => (
                <span key={item.value}>
                  <i style={{ background: item.color }} />
                  <span className="calendar-legend-full">{item.label}</span>
                  <span className="calendar-legend-short">{item.value}</span>
                </span>
              ))}
            </div>
          ))}
        <footer className="calendar-footer">
          {isAdmin && view !== 'Список' && <span>Пустые часы скрыты · время МСК</span>}
          {canCreate && view !== 'Список' && (
            <span>
              <Move size={13} />
              Перетаскивание — с подтверждением
            </span>
          )}
          <span>
            {scale === 'Весь день' && view !== 'Список' && gridHeight > available.height
              ? 'Названия сохранены · прокрутите календарь или разверните на весь экран'
              : isAdmin
                ? 'Нажмите на занятие, чтобы посмотреть клиентов и управлять записью'
                : 'Нажмите занятие для подробностей'}
          </span>
        </footer>
      </section>
    </div>
  );

  return (
    <>
      {fullscreen ? createPortal(content, document.body) : content}
      {createPortal(
        <>
          {deleting && canDelete(deleting) && (
            <ConfirmDialog
              title="Удалить тренировку?"
              subject={`${dayText(deleting.day)} · ${eventTime(deleting)} · ${deleting.room}`}
              onClose={closeDelete}
              confirmLabel="Удалить тренировку"
              cancelLabel="Оставить тренировку"
              onConfirm={deleteTraining}
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
              </div>
            </ConfirmDialog>
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
                        <i style={{ background: trainingIntensity(template).color }} />
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
              subtitle={`${pending.after.kind === 'personal' ? participantName(pending.after.memberId) : pending.after.name} · ${pending.after.trainer}`}
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
              title={opened.name}
              subtitle={`${dayText(opened.day)} · ${eventTime(opened)} · ${opened.room} · ${opened.club}`}
              onClose={closeDetails}
            >
              <div className="training-details">
                <div className="training-details-summary">
                  <p>
                    <span>Тренер</span>
                    <strong>{opened.trainer}</strong>
                  </p>
                  <p>
                    <span>Длительность</span>
                    <strong>{opened.duration} мин</strong>
                  </p>
                  <p>
                    <span>Интенсивность</span>
                    <strong className="training-intensity-value">
                      <i style={{ background: trainingIntensity(opened).color }} />
                      {trainingIntensity(opened).value}
                    </strong>
                  </p>
                  {heatmap && (
                    <p>
                      <span>Заполняемость</span>
                      <strong>
                        {eventOccupancy(opened).label} · {opened.booked}/{opened.capacity}
                      </strong>
                    </p>
                  )}
                  <Status>{opened.status}</Status>
                </div>
                <p>
                  {opened.description ||
                    `${opened.format || 'Групповое занятие'} в клубе «${opened.club}».`}
                </p>
                <ScheduleAttendees
                  key={opened.id}
                  event={opened}
                  onRegister={onRegister}
                  onSell={(member, event) => {
                    closeDetails();
                    setFullscreen(false);
                    navigate('services', member, undefined, {
                      saleTraining: event.kind === 'personal' ? 'personal' : 'group',
                      saleTrainerId: event.kind === 'personal' ? event.trainerId : undefined,
                    });
                  }}
                  members={members}
                  editable={isAdmin || isManagementRole(user.role)}
                  onMember={
                    isAdmin || isManagementRole(user.role)
                      ? (member) => {
                          closeDetails();
                          setFullscreen(false);
                          onMember(member);
                        }
                      : undefined
                  }
                />
                <div className="ws-actions">
                  {canEdit(opened) && (
                    <>
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setEditing({ ...opened });
                          closeDetails();
                        }}
                      >
                        <Move size={16} />
                        Перенести / изменить
                      </Button>
                      {canDelete(opened) && (
                        <Button
                          variant="secondary"
                          className="calendar-delete-action"
                          onClick={() => requestDelete(opened)}
                        >
                          <Trash2 size={16} />
                          Удалить тренировку
                        </Button>
                      )}
                    </>
                  )}
                  {canCancelEvent(opened, user) && (
                    <Button
                      variant="secondary"
                      className="calendar-delete-action"
                      onClick={() => setCancelling(opened)}
                    >
                      Отменить занятие
                    </Button>
                  )}
                  {opened.status === 'Отменено' && canCreate && (
                    <Button
                      onClick={() => {
                        const initial = seed(opened.time, opened.room, opened.day);
                        closeDetails();
                        openLibrary(initial);
                      }}
                    >
                      Добавить тренировку на это время
                    </Button>
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
                </div>
              </div>
            </Modal>
          )}
          {cancelling && canCancelEvent(cancelling, user) && (
            <ConfirmDialog
              title="Отменить занятие?"
              subject={`${cancelling.name} · ${dayText(cancelling.day)} · ${eventTime(cancelling)} · ${cancelling.club}`}
              description="Занятие останется в расписании с отметкой «Отменено». Записи и отметки присутствия сохранятся в истории."
              confirmLabel="Отменить занятие"
              cancelLabel="Оставить занятие"
              onClose={() => setCancelling(null)}
              onConfirm={() => {
                const current = data.events.find((row) => row.id === cancelling.id);
                if (current && canCancelEvent(current, user)) {
                  put('events', { ...current, status: 'Отменено' });
                  setMessage('Занятие отменено.');
                }
                setCancelling(null);
              }}
            />
          )}
          {copying && canCopy && (
            <ScheduleCopyDialog
              events={data.events}
              rooms={data.rooms}
              club={club}
              targetDay={week}
              onClose={closeCopy}
              onCopy={applyWeekCopy}
            />
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
    intensity: initial.intensity || 'Средняя',
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
              {demoClubs.map((item) => (
                <option key={item.id}>{item.shortName}</option>
              ))}
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
          {field(
            'intensity',
            'Интенсивность',
            'text',
            TRAINING_INTENSITIES.map((item) => item.value),
          )}
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
