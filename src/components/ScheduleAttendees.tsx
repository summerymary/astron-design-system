import { useState } from 'react';
import { Check, UserMinus } from 'lucide-react';
import { Avatar, Button, ConfirmDialog, IconButton, Modal } from './ui';
import { ClientSearch } from './ClientSearch';
import { useWorkspace } from './WorkspaceProvider';
import { clientTrainers, personalBooking, personalTrainers } from '../lib/personal-training';
import { clientName } from '../lib/client-display';
import { changeAttendance, changeReserve, rosterIds } from '../lib/schedule-attendance';
import { memberCards } from '../data/admin';
import { getClientProfile } from '../data/clientProfile';
import { ageOnDate, availableVisitPasses, registrationBookings } from '../lib/registration';
import { demoStamp, registrationNow } from '../lib/demo-clock';
import { VisitPassList } from './VisitPassList';
import { Notice } from './WorkspaceUI';
import type { Member, RegisterVisit } from '../types';
import type { DemoRecord } from '../data/workspace';

export function ScheduleAttendees({
  event,
  members,
  editable,
  onMember,
  onRegister,
  onSell,
}: {
  event: DemoRecord;
  members: Member[];
  editable: boolean;
  onMember?: (member: Member) => void;
  onRegister: RegisterVisit;
  onSell: (member: Member, event: DemoRecord) => void;
}) {
  const { data, put, registerTrainingVisit } = useWorkspace();
  const [removing, setRemoving] = useState<Member | null>(null);
  const [removingReserve, setRemovingReserve] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [confirming, setConfirming] = useState<Member | null>(null);
  const [selectedPassId, setSelectedPassId] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [visitError, setVisitError] = useState('');
  const at = demoStamp(registrationNow());
  const currentEvent = personalBooking(
    data.events.find((row) => row.id === event.id) || event,
    data,
  );
  const options = (member: Member) => {
    const profile = getClientProfile(member, data);
    return {
      profile,
      age: ageOnDate(profile.birthDate, at.slice(0, 10)),
      passes: availableVisitPasses(profile.subscriptions, at, profile.birthDate, currentEvent),
    };
  };
  const markVisit = (member: Member, passId: string, supervised = false) => {
    if (!editable) return;
    try {
      const now = demoStamp(registrationNow());
      const result = registerTrainingVisit({
        member,
        eventId: event.id,
        passId,
        at: now,
        acknowledged: supervised,
      });
      onRegister(
        member,
        result.event.kind === 'personal' ? 'personal' : 'group',
        result.pass.name,
        result.pass.id,
        { at: now, club: result.event.club, eventId: event.id },
      );
      setFeedback(`Присутствие отмечено. Посещение списано с абонемента «${result.pass.name}».`);
      setConfirming(null);
      setVisitError('');
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Не удалось отметить посещение.';
      setVisitError(text);
      setFeedback(text);
    }
  };
  const startVisit = (member: Member) => {
    if (!editable) return;
    if (!registrationBookings([currentEvent], member.id, currentEvent.club, at).length) {
      setFeedback(
        'Отметить посещение можно за 60 минут до начала и 30 минут после начала занятия.',
      );
      return;
    }
    const { passes, age } = options(member);
    if (passes.length === 1 && age !== null && age >= 14) {
      markVisit(member, passes[0].id);
      return;
    }
    setConfirming(member);
    setSelectedPassId(passes.length === 1 ? passes[0].id : '');
    setAcknowledged(false);
    setVisitError('');
  };
  const choice = confirming ? options(confirming) : null;
  const trainerVerified =
    currentEvent.kind === 'personal' &&
    (data.employees || []).some(
      (row) =>
        row.name === currentEvent.trainer &&
        row.status === 'Активен' &&
        row.position?.toLocaleLowerCase('ru').includes('тренер'),
    );
  const ids = rosterIds(event.attendees);
  const present = rosterIds(event.present);
  const reserve = rosterIds(event.reserve);
  const full = ids.length >= Number(event.capacity);
  const mutable = editable && event.status !== 'Отменено';
  const change = (member: Member, action: 'book' | 'remove' | 'reserve' | 'unreserve') => {
    if (!editable) return;
    const current = data.events.find((row) => row.id === event.id);
    if (!current) return setFeedback('Занятие больше недоступно.');
    const trainer =
      current.kind === 'personal'
        ? personalTrainers(data).find(
            (row) => row.id === current.trainerId || row.name === current.trainer,
          )
        : undefined;
    const assigned = clientTrainers(data, member.id);
    if (
      (action === 'book' || action === 'reserve') &&
      current.kind === 'personal' &&
      (!trainer || (assigned.length && !assigned.some((row) => row.id === trainer.id)))
    )
      return setFeedback('Выберите персонального тренера, за которым закреплён клиент.');
    const next =
      action === 'reserve' || action === 'unreserve'
        ? changeReserve(current, member, action === 'reserve' ? 'join' : 'leave')
        : changeAttendance(current, member, action, data.events);
    if (typeof next === 'string') return setFeedback(next);
    if (action === 'book' && trainer && !assigned.length)
      put('personal-clients', {
        id: `${trainer.id}:${member.id}`,
        trainerId: trainer.id,
        memberId: String(member.id),
        goal: '',
      });
    put('events', personalBooking(next, data));
    setFeedback(
      action === 'reserve'
        ? 'Клиент добавлен в резерв. Посещение не списывается.'
        : action === 'unreserve'
          ? 'Клиент удалён из резерва.'
          : action === 'book'
            ? 'Клиент записан.'
            : action === 'remove'
              ? 'Запись снята.'
              : '',
    );
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
            onMember={(member) => change(member, full ? 'reserve' : 'book')}
            resultAction={(member) => {
              const booked = ids.includes(String(member.id));
              const reserved = reserve.includes(String(member.id));
              const assigned = clientTrainers(data, member.id);
              const trainer = personalTrainers(data).find(
                (row) => row.id === event.trainerId || row.name === event.trainer,
              );
              const otherTrainer =
                event.kind === 'personal' &&
                (!trainer ||
                  (assigned.length > 0 && !assigned.some((row) => row.id === trainer.id)));
              return {
                label: otherTrainer
                  ? 'Другой персональный тренер'
                  : booked
                    ? 'Уже записан'
                    : reserved
                      ? 'Уже в резерве'
                      : full
                        ? 'Добавить в резерв'
                        : event.kind === 'personal' && !assigned.length
                          ? 'Записать и закрепить'
                          : 'Записать клиента',
                disabled: booked || reserved || otherTrainer,
              };
            }}
            mode="selection"
            purpose="занятия"
            hidePhones
          />
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
                <small>
                  Карта {member.cardNumber ?? memberCards[member.id] ?? String(member.id + 99000)}
                </small>
              </div>
              {mutable ? (
                <>
                  <Button
                    variant="success"
                    aria-pressed={present.includes(id)}
                    disabled={present.includes(id)}
                    onClick={() => startVisit(member)}
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
      {confirming && choice && (
        <Modal
          title="Отметить посещение"
          subtitle={clientName(confirming)}
          size="wide"
          onClose={() => setConfirming(null)}
        >
          <div className="modal-scroll-body ws-stack">
            <p>
              {event.name} · {event.day.split('-').reverse().join('.')} · {event.time}
            </p>
            {(choice.age === null || choice.age < 14) && (
              <Notice tone="warning">
                <strong>
                  {choice.age === null
                    ? 'Укажите дату рождения в карточке клиента.'
                    : `Клиенту ${choice.age} лет — требуется сопровождение.`}
                </strong>
                {trainerVerified ? (
                  <p>Есть запись к тренеру {currentEvent.trainer}.</p>
                ) : (
                  choice.age !== null && (
                    <label className="registration-supervision-check">
                      <input
                        type="checkbox"
                        checked={acknowledged}
                        onChange={(event) => setAcknowledged(event.target.checked)}
                      />
                      Подтверждаю, что клиент будет заниматься с тренером или ответственным взрослым
                    </label>
                  )
                )}
              </Notice>
            )}
            {choice.passes.length ? (
              <>
                <p>Будет списано одно посещение выбранного абонемента.</p>
                <VisitPassList
                  passes={choice.passes}
                  value={selectedPassId}
                  onChange={setSelectedPassId}
                  categoryNames={Object.fromEntries(
                    (data['trainer-categories'] || []).map((row) => [row.id, row.name]),
                  )}
                />
              </>
            ) : (
              <Notice tone="warning">
                Нет подходящего абонемента на{' '}
                {event.kind === 'personal'
                  ? 'персональную тренировку этой категории тренера'
                  : 'групповые занятия'}
                . Посещение не списано, присутствие не отмечено.
              </Notice>
            )}
            {visitError && <p role="alert">{visitError}</p>}
          </div>
          <div className="form-actions">
            <Button variant="secondary" onClick={() => setConfirming(null)}>
              Отмена
            </Button>
            {choice.passes.length ? (
              <Button
                disabled={
                  !selectedPassId ||
                  choice.age === null ||
                  (choice.age < 14 && !trainerVerified && !acknowledged)
                }
                onClick={() => markVisit(confirming, selectedPassId, acknowledged)}
              >
                Подтвердить посещение
              </Button>
            ) : (
              <Button onClick={() => onSell(confirming, currentEvent)}>
                Продать подходящий абонемент
              </Button>
            )}
          </div>
        </Modal>
      )}
      {removing && (
        <ConfirmDialog
          title={removingReserve ? 'Убрать клиента из резерва?' : 'Снять запись клиента?'}
          subject={clientName(removing)}
          description={
            removingReserve
              ? 'Клиент будет удалён из резерва этого занятия. Абонемент сохраняется.'
              : 'Клиент будет удалён из списка этого занятия. Уже списанное посещение не возвращается.'
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
