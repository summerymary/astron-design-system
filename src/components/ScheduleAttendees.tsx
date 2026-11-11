import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Plus, UserMinus } from 'lucide-react';
import { Avatar, Button, Modal } from './ui';
import { ClientSearch } from './ClientSearch';
import { useWorkspace } from './WorkspaceProvider';
import { clientName } from '../lib/client-display';
import { changeAttendance, rosterIds } from '../lib/schedule-attendance';
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
  const [feedback, setFeedback] = useState('');
  const ids = rosterIds(event.attendees);
  const present = rosterIds(event.present);
  const mutable = editable && event.status !== 'Отменено';
  const change = (member: Member, action: 'book' | 'remove' | 'present' | 'absent') => {
    if (!editable) return;
    const current = data.events.find((row) => row.id === event.id);
    if (!current) return setFeedback('Занятие больше недоступно.');
    const next = changeAttendance(current, member, action, data.events);
    if (typeof next === 'string') return setFeedback(next);
    put('events', next);
    setFeedback(
      action === 'book'
        ? 'Клиент записан.'
        : action === 'remove'
          ? 'Запись снята.'
          : action === 'present'
            ? 'Присутствие отмечено.'
            : 'Отметка присутствия снята.',
    );
    if (action === 'book') setSelected(null);
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
                disabled={ids.includes(String(selected.id)) || ids.length >= Number(event.capacity)}
                onClick={() => change(selected, 'book')}
              >
                <Plus size={16} />
                Записать клиента
              </Button>
            </div>
          )}
          {ids.length >= Number(event.capacity) && <p>Все места заняты.</p>}
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
                  <button
                    className="icon-button"
                    aria-label={`Снять запись: ${clientName(member)}`}
                    title="Снять запись"
                    onClick={() => setRemoving(member)}
                  >
                    <UserMinus size={17} />
                  </button>
                </>
              ) : (
                <span>{present.includes(id) ? 'Присутствовал' : 'Записан'}</span>
              )}
            </div>
          );
        })}
      </div>
      {removing &&
        createPortal(
          <Modal
            title="Снять запись клиента?"
            subtitle={clientName(removing)}
            onClose={() => setRemoving(null)}
          >
            <p>Клиент будет удалён из списка этого занятия. Абонемент сохраняется.</p>
            <div className="modal-actions">
              <Button variant="secondary" onClick={() => setRemoving(null)}>
                Оставить запись
              </Button>
              <Button onClick={() => change(removing, 'remove')}>Снять запись</Button>
            </div>
          </Modal>,
          document.body,
        )}
    </section>
  );
}
