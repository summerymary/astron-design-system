import { useCallback, useRef, useState } from 'react';
import { ArrowRight, CalendarDays, Edit3, NotebookPen, Plus, CupSoda } from 'lucide-react';
import { Avatar, Button, Modal } from '../components/ui';
import {
  DataTable,
  Empty,
  Notice,
  ResourcePage,
  SearchBox,
  Stats,
  Status,
} from '../components/WorkspaceUI';
import type { Navigate } from '../components/WorkspaceUI';
import { demoId, useWorkspace } from '../components/WorkspaceProvider';
import { money, resources, TODAY } from '../data/workspace';
import type { DemoRecord } from '../data/workspace';
import type { DemoUser, Member } from '../types';
import { dayText, eventTime, nextFreeTime, validateEvent } from '../lib/schedule';
import { noteError, personalClients, personalScopeError } from '../lib/staff-rules';
import { BarWorkspace } from './WorkspaceOperations';
import '../styles/staff.css';

export function personalDraft(
  data: Record<string, DemoRecord[]>,
  user: DemoUser,
  club: string,
  day = TODAY,
  roomName = '',
  time = '',
): DemoRecord {
  const room =
    data.rooms.find((r) => r.club === club && r.name === roomName && r.status !== 'В архиве') ||
    data.rooms.find((r) => r.club === club && r.name === 'Зал персональных тренировок') ||
    data.rooms.find((r) => r.club === club && r.status !== 'В архиве');
  return {
    id: demoId('personal'),
    kind: 'personal',
    name: 'Персональная тренировка',
    trainerId: user.id,
    trainer: user.name,
    club,
    room: room?.name || '',
    day,
    time: time || nextFreeTime(data.events, day, club, room?.name || '', 50, user.name),
    duration: '50',
    memberId: '',
    attendees: '',
    capacity: '1',
    capacityMode: 'Своя вместимость',
    booked: '1',
    format: 'Персональное',
    color: '#8A332C',
    status: 'Запланирована',
    description: '',
  };
}

export function PersonalTrainingForm({
  initial,
  user,
  members,
  onClose,
  onSave,
}: {
  initial: DemoRecord;
  user: DemoUser;
  members: Member[];
  onClose: () => void;
  onSave: (record: DemoRecord) => string | void;
}) {
  const { data } = useWorkspace();
  const [draft, setDraft] = useState<DemoRecord>({ ...initial });
  const [error, setError] = useState('');
  const ownerId = initial.trainerId || user.id;
  const clients = personalClients(data, members, ownerId);
  const set = (key: string, value: string) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setError('');
  };
  const rooms = data.rooms.filter((r) => r.club === draft.club && r.status !== 'В архиве');
  return (
    <Modal
      title="Персональная тренировка"
      subtitle={`${initial.trainer || user.name} · один тренер и один клиент`}
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
          const record: DemoRecord = {
            ...draft,
            ...values,
            kind: 'personal',
            name: 'Персональная тренировка',
            trainerId: ownerId,
            trainer: initial.trainer || user.name,
            format: 'Персональное',
            capacity: '1',
            booked: '1',
            capacityMode: 'Своя вместимость',
            attendees: values.memberId,
          };
          const problem =
            personalScopeError(record, user, data['personal-clients'] || []) || onSave(record);
          if (problem) setError(problem);
        }}
      >
        <label className="form-field">
          <span>Персональный клиент *</span>
          <select
            name="memberId"
            value={draft.memberId || ''}
            required
            onChange={(e) => set('memberId', e.target.value)}
          >
            <option value="">Выберите клиента</option>
            {clients.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>
        </label>
        {!clients.length && (
          <Notice tone="warning">За этим тренером пока нет закреплённых клиентов.</Notice>
        )}
        <div className="calendar-form-grid">
          <label className="form-field">
            <span>Дата *</span>
            <input
              name="day"
              type="date"
              required
              value={draft.day}
              onInput={(e) => set('day', e.currentTarget.value)}
              onChange={(e) => set('day', e.target.value)}
            />
          </label>
          <label className="form-field">
            <span>Начало *</span>
            <input
              name="time"
              type="time"
              required
              value={draft.time}
              onInput={(e) => set('time', e.currentTarget.value)}
              onChange={(e) => set('time', e.target.value)}
            />
          </label>
          <label className="form-field">
            <span>Длительность, мин *</span>
            <input
              name="duration"
              type="number"
              required
              min="5"
              max="240"
              step="5"
              value={draft.duration}
              onInput={(e) => set('duration', e.currentTarget.value)}
              onChange={(e) => set('duration', e.target.value)}
            />
          </label>
          <label className="form-field">
            <span>Зал *</span>
            <select
              name="room"
              required
              value={draft.room}
              onChange={(e) => set('room', e.target.value)}
            >
              <option value="">Выберите зал</option>
              {rooms.map((room) => (
                <option key={room.id}>{room.name}</option>
              ))}
            </select>
          </label>
        </div>
        <p className="staff-form-context">
          Клуб: {draft.club} · Тренер: {initial.trainer || user.name}
        </p>
        <label className="form-field">
          <span>План тренировки</span>
          <textarea
            name="description"
            rows={3}
            maxLength={2000}
            value={draft.description || ''}
            onChange={(e) => set('description', e.target.value)}
            placeholder="Например, разминка и техника основных упражнений"
          />
        </label>
        {error && <Notice tone="warning">{error}</Notice>}
        <div className="modal-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" disabled={!clients.length}>
            Сохранить тренировку
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function TrainerHome({
  user,
  members,
  clubName,
  navigate,
}: {
  user: DemoUser;
  members: Member[];
  clubName: string;
  navigate: Navigate;
}) {
  const { data, put } = useWorkspace();
  const [form, setForm] = useState<DemoRecord | null>(null);
  const [message, setMessage] = useState('');
  const close = useCallback(() => setForm(null), []);
  const clients = personalClients(data, members, user.id);
  const sessions = data.events
    .filter((e) => e.trainer === user.name && e.day === TODAY && e.status !== 'Отменено')
    .sort((a, b) => a.time.localeCompare(b.time));
  return (
    <div className="ws-stack staff-workspace">
      <section className="staff-actions" aria-label="Действия тренера">
        <div className="ws-actions">
          <Button
            onClick={() =>
              setForm(personalDraft(data, user, clubName.split(' · ').at(-1) || 'Центральный'))
            }
          >
            <Plus size={16} />
            Персональная тренировка
          </Button>
          <Button variant="ghost" onClick={() => navigate('trainer-clients')}>
            <NotebookPen size={16} />
            Мои клиенты
          </Button>
        </div>
      </section>
      {message && <Notice tone="success">{message}</Notice>}
      <Stats
        items={[
          { label: 'Занятия сегодня', value: sessions.length },
          {
            label: 'Персональные тренировки',
            value: sessions.filter((e) => e.kind === 'personal').length,
          },
          { label: 'Мои клиенты', value: clients.length },
        ]}
      />
      <section className="panel ws-panel">
        <div className="ws-panel-heading">
          <div>
            <h2>Ближайшие занятия</h2>
            <p>
              {dayText(TODAY)} · {clubName}
            </p>
          </div>
          <Button variant="ghost" onClick={() => navigate('schedule')}>
            Расписание
            <ArrowRight size={15} />
          </Button>
        </div>
        <div className="staff-session-list">
          {sessions.slice(0, 5).map((event) => (
            <button key={event.id} onClick={() => navigate('schedule')}>
              <time>{eventTime(event)}</time>
              <span>
                <strong>
                  {event.kind === 'personal'
                    ? members.find((m) => String(m.id) === event.memberId)?.name
                    : event.name}
                </strong>
                <small>
                  {event.kind === 'personal' ? 'Персональная тренировка' : 'Групповое занятие'} ·{' '}
                  {event.room}
                </small>
              </span>
              <Status>
                {event.kind === 'personal' ? 'Персональная' : `${event.booked}/${event.capacity}`}
              </Status>
              <ArrowRight size={16} />
            </button>
          ))}
        </div>
        {!sessions.length && (
          <Empty
            title="На этот день нет занятий"
            text="Добавьте персональную тренировку или выберите другой день в расписании."
          />
        )}
        {sessions.length > 5 && (
          <div className="ws-panel-body">
            <Button variant="secondary" onClick={() => navigate('schedule')}>
              Открыть все занятия: {sessions.length}
            </Button>
          </div>
        )}
      </section>
      {form && (
        <PersonalTrainingForm
          initial={form}
          user={user}
          members={members}
          onClose={close}
          onSave={(record) => {
            const problem = validateEvent(record, data.events, data.rooms);
            if (problem) return problem;
            put('events', record);
            setForm(null);
            setMessage(
              `Тренировка добавлена: ${dayText(record.day)}, ${eventTime(record)}. Она уже видна в расписании.`,
            );
          }}
        />
      )}
    </div>
  );
}

export function TrainerClients({
  user,
  members,
  initialMember,
  navigate,
}: {
  user: DemoUser;
  members: Member[];
  initialMember: Member | null;
  navigate: Navigate;
}) {
  const { data, put } = useWorkspace();
  const clients = personalClients(data, members, user.id);
  const [selectedId, setSelectedId] = useState(
    initialMember && clients.some((m) => m.id === initialMember.id)
      ? initialMember.id
      : clients[0]?.id,
  );
  const [query, setQuery] = useState('');
  const [drafts, setDrafts] = useState<Record<string, { text: string; editingId: string }>>({});
  const [message, setMessage] = useState('');
  const detail = useRef<HTMLDivElement>(null);
  const selected = clients.find((m) => m.id === selectedId);
  const draft = drafts[String(selectedId)] || { text: '', editingId: '' };
  const notes = (data['trainer-notes'] || [])
    .filter((n) => n.trainerId === user.id && n.memberId === String(selectedId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const sessions = data.events
    .filter(
      (e) =>
        e.kind === 'personal' &&
        e.trainerId === user.id &&
        e.memberId === String(selectedId) &&
        e.status !== 'Отменено',
    )
    .sort((a, b) => `${a.day}${a.time}`.localeCompare(`${b.day}${b.time}`));
  const setDraft = (patch: Partial<typeof draft>) =>
    setDrafts((d) => ({ ...d, [String(selectedId)]: { ...draft, ...patch } }));
  if (!clients.length)
    return (
      <Empty
        title="Пока нет персональных клиентов"
        text="Закреплённые за тренером клиенты появятся здесь."
      />
    );
  if (initialMember && !clients.some((member) => member.id === initialMember.id))
    return (
      <Empty
        title="Клиент недоступен"
        text="Откройте заметки из списка своих персональных клиентов."
        action={
          <Button variant="secondary" onClick={() => navigate('trainer-clients')}>
            Мои клиенты
          </Button>
        }
      />
    );
  return (
    <div className="staff-clients-layout">
      <section className="panel ws-panel">
        <div className="ws-panel-heading">
          <h2>
            Мои клиенты <span className="count-badge">{clients.length}</span>
          </h2>
        </div>
        <div className="ws-panel-body">
          <SearchBox value={query} onChange={setQuery} placeholder="Имя клиента" />
        </div>
        <div className="staff-client-list">
          {clients
            .filter((m) => m.name.toLocaleLowerCase('ru').includes(query.toLocaleLowerCase('ru')))
            .map((member) => (
              <button
                key={member.id}
                className={selectedId === member.id ? 'selected' : ''}
                aria-pressed={selectedId === member.id}
                onClick={() => {
                  setSelectedId(member.id);
                  setMessage('');
                  if (
                    (detail.current?.closest('.app-shell')?.clientWidth || window.innerWidth) < 700
                  ) {
                    const viewport = detail.current?.closest<HTMLElement>('.app-content');
                    if (viewport && detail.current && viewport.scrollHeight > viewport.clientHeight)
                      viewport.scrollTo({
                        top:
                          viewport.scrollTop +
                          detail.current.getBoundingClientRect().top -
                          viewport.getBoundingClientRect().top -
                          12,
                        behavior: 'smooth',
                      });
                    else detail.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
                  }
                }}
              >
                <Avatar member={member} small />
                <span>
                  <strong>{member.name}</strong>
                  <small>
                    Заметок:{' '}
                    {
                      (data['trainer-notes'] || []).filter(
                        (n) => n.trainerId === user.id && n.memberId === String(member.id),
                      ).length
                    }
                  </small>
                </span>
                <ArrowRight size={15} />
              </button>
            ))}
        </div>
      </section>
      {selected && (
        <div className="ws-stack" ref={detail}>
          <section className="panel ws-panel">
            <div className="ws-panel-heading">
              <div>
                <h2>{selected.name}</h2>
                <p>
                  {
                    (data['personal-clients'] || []).find(
                      (r) => r.trainerId === user.id && r.memberId === String(selected.id),
                    )?.goal
                  }
                </p>
              </div>
              <Avatar member={selected} />
            </div>
            <div className="ws-panel-body ws-stack">
              <h3>Заметки тренера</h3>
              <form
                className="ws-stack"
                onSubmit={(e) => {
                  e.preventDefault();
                  const problem = noteError(
                    draft.text,
                    user.id,
                    String(selected.id),
                    data['personal-clients'] || [],
                  );
                  if (problem) {
                    setMessage(problem);
                    return;
                  }
                  const original = notes.find((n) => n.id === draft.editingId);
                  put('trainer-notes', {
                    id: original?.id || demoId('trainer-note'),
                    trainerId: user.id,
                    memberId: String(selected.id),
                    text: draft.text.trim(),
                    author: user.name,
                    createdAt: original?.createdAt || new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                  });
                  setDraft({ text: '', editingId: '' });
                  setMessage('Заметка сохранена.');
                }}
              >
                <label className="form-field">
                  <span>{draft.editingId ? 'Изменить заметку' : 'Новая заметка'}</span>
                  <textarea
                    rows={4}
                    required
                    maxLength={2000}
                    value={draft.text}
                    onInput={(e) => setDraft({ text: e.currentTarget.value })}
                    onChange={(e) => setDraft({ text: e.target.value })}
                    placeholder="Что получилось и на что обратить внимание на следующем занятии"
                  />
                </label>
                <div className="ws-actions">
                  <Button disabled={!draft.text.trim()}>
                    <NotebookPen size={15} />
                    {draft.editingId ? 'Сохранить изменения' : 'Сохранить заметку'}
                  </Button>
                  {draft.editingId && (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setDraft({ text: '', editingId: '' })}
                    >
                      Отмена
                    </Button>
                  )}
                </div>
              </form>
              {message && <Notice>{message}</Notice>}
              {notes.map((note) => (
                <article className="staff-note" key={note.id}>
                  <div>
                    <time>
                      {new Date(note.createdAt).toLocaleString('ru-RU', {
                        timeZone: 'Europe/Moscow',
                        day: 'numeric',
                        month: 'long',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </time>
                    <Button
                      variant="ghost"
                      onClick={() => setDraft({ text: note.text, editingId: note.id })}
                    >
                      <Edit3 size={14} />
                      Изменить
                    </Button>
                  </div>
                  <p>{note.text}</p>
                </article>
              ))}
              {!notes.length && (
                <p className="staff-muted">
                  Заметок пока нет. Сохраните наблюдения после тренировки.
                </p>
              )}
            </div>
          </section>
          <section className="panel ws-panel">
            <div className="ws-panel-heading">
              <h2>Персональные тренировки</h2>
              <Button variant="ghost" onClick={() => navigate('schedule')}>
                <CalendarDays size={15} />
                Расписание
              </Button>
            </div>
            <div className="ws-panel-body ws-stack">
              {sessions.map((event) => (
                <div className="staff-client-session" key={event.id}>
                  <strong>
                    {dayText(event.day)} · {eventTime(event)}
                  </strong>
                  <span>{event.room}</span>
                  {event.description && <p>{event.description}</p>}
                </div>
              ))}
              {!sessions.length && (
                <p className="staff-muted">Запланированных персональных тренировок пока нет.</p>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export function BartenderHome({ clubName, navigate }: { clubName: string; navigate: Navigate }) {
  const { data } = useWorkspace();
  const club = clubName.split(' · ').at(-1);
  const sales = data.ledger.filter(
    (r) => r.category === 'Бар' && r.club === club && r.date === TODAY,
  );
  return (
    <div className="ws-stack staff-workspace">
      <Stats
        items={[
          {
            label: 'Продажи бара сегодня',
            value: money(sales.reduce((sum, r) => sum + Number(r.amount), 0)),
          },
          { label: 'Позиций продано', value: sales.length },
          {
            label: 'Товаров в каталоге',
            value: data.products.filter((p) => p.status === 'Активен').length,
          },
        ]}
      />
      <BarWorkspace navigate={navigate} clubName={clubName} limited />
    </div>
  );
}
export function BarCatalog({ navigate }: { navigate: Navigate }) {
  return (
    <ResourcePage
      collection="products"
      config={{
        ...resources.products,
        title: 'Каталог бара',
        description: 'Напитки, цены и остатки для работы смены.',
        readonly: true,
        links: [],
      }}
      navigate={navigate}
    />
  );
}
export function BarSales({ clubName }: { clubName: string }) {
  const { data } = useWorkspace();
  const rows = data.ledger.filter(
    (r) => r.category === 'Бар' && r.club === clubName.split(' · ').at(-1),
  );
  return (
    <section className="panel ws-panel">
      <div className="ws-panel-heading">
        <div>
          <h2>Продажи бара</h2>
          <p>{clubName} · только демозаказы бара</p>
        </div>
        <CupSoda size={20} />
      </div>
      <DataTable
        rows={rows}
        columns={[
          { key: 'date', label: 'Дата' },
          { key: 'name', label: 'Позиция' },
          { key: 'amount', label: 'Сумма, ₽' },
          { key: 'method', label: 'Оплата' },
          { key: 'status', label: 'Статус' },
        ]}
      />
    </section>
  );
}
