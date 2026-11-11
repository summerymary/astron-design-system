import { useState } from 'react';
import { Check, Plus, UserMinus } from 'lucide-react';
import { Avatar, Button, ConfirmDialog, IconButton } from './ui';
import { ClientSearch } from './ClientSearch';
import { useWorkspace } from './WorkspaceProvider';
import { clientName } from '../lib/client-display';
import { changeAttendance, changeReserve, rosterIds } from '../lib/schedule-attendance';
import { memberCards } from '../data/admin';
import type { Member } from '../types';
import type { DemoRecord } from '../data/workspace';

export function ScheduleAttendees({
  event,
  members,
  editable,
  onMember,
}: {
  event: DemoRecord;
  members: Member[];
  editable: boolean;
  onMember?: (member: Member) => void;
}) {
  const { data, put } = useWorkspace();
  const [selected, setSelected] = useState<Member | null>(null);
  const [removing, setRemoving] = useState<Member | null>(null);
  const [removingReserve, setRemovingReserve] = useState(false);
  const [feedback, setFeedback] = useState('');
  const ids = rosterIds(event.attendees);
  const present = rosterIds(event.present);
  const reserve = rosterIds(event.reserve);
  const full = ids.length >= Number(event.capacity);
  const mutable = editable && event.status !== 'Отменено';
  const change = (
    member: Member,
    action: 'book' | 'remove' | 'present' | 'absent' | 'reserve' | 'unreserve',
  ) => {
    if (!editable) return;
    const current = data.events.find((row) => row.id === event.id);
    if (!current) return setFeedback('Занятие больше недоступно.');
    const next =
      action === 'reserve' || action === 'unreserve'
        ? changeReserve(current, member, action === 'reserve' ? 'join' : 'leave')
        : changeAttendance(current, member, action, data.events);
    if (typeof next === 'string') return setFeedback(next);
    put('events', next);
    setFeedback(
      action === 'reserve'
        ? 'Клиент добавлен в резерв. Посещение не списывается.'
        : action === 'unreserve'
          ? 'Клиент удалён из резерва.'
          : action === 'book'
            ? 'Клиент записан.'
            : action === 'remove'
              ? 'Запись снята.'
              : action === 'present'
                ? 'Присутствие отмечено.'
                : 'Отметка присутствия снята.',
    );
    if (action === 'book' || action === 'reserve') setSelected(null);
    if (action === 'remove') setRemoving(null);
  };
  return (
    <section className="schedule-attendees" aria-label="Клиенты на занятии">
      <h3>
        Записанные клиенты{' '}
        <span>
          {ids.length} / {event.capacity}
        </span>
      </h3>
      <p className="schedule-attendance-total">Присутствуют: {present.length}</p>
      {mutable && event.status !== 'Завершено' && (
        <div className="schedule-book-client">
          <ClientSearch
            members={members}
            onMember={setSelected}
            mode="selection"
            purpose="занятия"
            hidePhones
          />
          {selected && (
            <div className="schedule-book-selection">
              <Avatar member={selected} />
              <strong>{clientName(selected)}</strong>
              <Button
                disabled={
                  ids.includes(String(selected.id)) || reserve.includes(String(selected.id))
                }
                onClick={() => change(selected, full ? 'reserve' : 'book')}
              >
                <Plus size={16} />
                {full ? 'Добавить в резерв' : 'Записать клиента'}
              </Button>
            </div>
          )}
          {full && <p>Все места заняты. Можно записать клиента в резерв.</p>}
        </div>
      )}
      {feedback && <p role="status">{feedback}</p>}
      <div className="schedule-roster-list">
        {!ids.length && <p>Пока никто не записан.</p>}
        {ids.map((id) => {
          const member = members.find((m) => String(m.id) === id);
          if (!member) return null;
          return (
            <div className="schedule-roster-row" key={id}>
              <Avatar member={member} />
              <div>
                <button
                  className="schedule-client-name"
                  disabled={!onMember}
                  onClick={() => onMember?.(member)}
                >
                  {clientName(member)}
                </button>
                <small>Карта {memberCards[member.id] || member.id + 99000}</small>
              </div>
              {mutable ? (
                <>
                  <Button
                    variant="secondary"
                    aria-pressed={present.includes(id)}
                    onClick={() => change(member, present.includes(id) ? 'absent' : 'present')}
                  >
                    <Check size={15} />
                    {present.includes(id) ? 'Присутствует' : 'Отметить'}
                  </Button>
                  <IconButton
                    tone="danger"
                    label={`Снять запись: ${clientName(member)}`}
                    title="Снять запись"
                    onClick={() => {
                      setRemovingReserve(false);
                      setRemoving(member);
                    }}
                  >
                    <UserMinus size={17} />
                  </IconButton>
                </>
              ) : (
                <span>{present.includes(id) ? 'Присутствовал' : 'Записан'}</span>
              )}
            </div>
          );
        })}
      </div>
      {!!reserve.length && (
        <section className="schedule-reserve" aria-label="Резерв занятия">
          <h4>Резерв · {reserve.length}</h4>
          {!full && mutable && (
            <p className="schedule-reserve-available" role="status">
              Освободилось мест: {Number(event.capacity) - ids.length}. Можно записать клиента из
              резерва.
            </p>
          )}
          {reserve.map((id, index) => {
            const member = members.find((item) => String(item.id) === id);
            if (!member) return null;
            return (
              <div className="schedule-roster-row" key={id}>
                <span className="reserve-position">{index + 1}</span>
                <Avatar member={member} />
                <div>
                  <button
                    className="schedule-client-name"
                    disabled={!onMember}
                    onClick={() => onMember?.(member)}
                  >
                    {clientName(member)}
                  </button>
                  <small>Ожидает свободное место</small>
                </div>
                {mutable && event.status !== 'Завершено' && (
                  <>
                    <Button
                      variant="secondary"
                      disabled={full}
                      onClick={() => change(member, 'book')}
                    >
                      Записать из резерва
                    </Button>
                    <IconButton
                      tone="danger"
                      label={`Убрать из резерва: ${clientName(member)}`}
                      onClick={() => {
                        setRemovingReserve(true);
                        setRemoving(member);
                      }}
                    >
                      <UserMinus size={17} />
                    </IconButton>
                  </>
                )}
              </div>
            );
          })}
        </section>
      )}
      {removing && (
        <ConfirmDialog
          title={removingReserve ? 'Убрать клиента из резерва?' : 'Снять запись клиента?'}
          subject={clientName(removing)}
          description={
            removingReserve
              ? 'Клиент будет удалён из резерва этого занятия. Абонемент сохраняется.'
              : 'Клиент будет удалён из списка этого занятия. Абонемент сохраняется.'
          }
          confirmLabel={removingReserve ? 'Убрать из резерва' : 'Снять запись'}
          cancelLabel="Оставить запись"
          onClose={() => setRemoving(null)}
          onConfirm={() => {
            change(removing, removingReserve ? 'unreserve' : 'remove');
            setRemoving(null);
          }}
        />
      )}
    </section>
  );
}
