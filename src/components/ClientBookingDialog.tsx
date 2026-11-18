import { Field } from './Field';
import '../styles/client-booking.css';
import { useId, useState } from 'react';
import type { DemoUser, Member } from '../types';
import type { DemoRecord } from '../data/workspace';
import { money, prettyDate } from '../data/workspace';
import { demoStamp, registrationNow } from '../lib/demo-clock';
import { clientTrainers, personalTrainers } from '../lib/personal-training';
import {
  createPersonalBooking,
  nearestGroupEvents,
  personalBookingSlots,
} from '../lib/client-booking';
import { changeAttendance, changeReserve, rosterIds } from '../lib/schedule-attendance';
import { canOpenModule } from '../lib/staff-rules';
import { clientName } from '../lib/client-display';
import { demoId, useWorkspace } from './WorkspaceProvider';
import { Button, Modal } from './ui';
import { Select } from './Select';
import { Empty, Notice, Tabs } from './WorkspaceUI';

export function ClientBookingDialog({
  member,
  user,
  clubName,
  onClose,
  onBooked,
  initialKind = 'group',
  initialTrainerId,
}: {
  initialKind?: 'group' | 'personal';
  initialTrainerId?: string;
  member: Member;
  user: DemoUser;
  clubName: string;
  onClose: () => void;
  onBooked: (event: DemoRecord, reserved: boolean) => void;
}) {
  const { data, put } = useWorkspace();
  const formId = useId();
  const assigned = clientTrainers(data, member.id);
  const selfBooking = user.role === 'trainer';
  const [kind, setKind] = useState(
    selfBooking || initialKind === 'personal' ? 'Персональные' : 'Групповые',
  );
  const [club, setClub] = useState(clubName.split(' · ').at(-1)!);
  const [trainerId, setTrainerId] = useState(
    (selfBooking ? user.id : initialTrainerId) ||
      assigned[0]?.id ||
      personalTrainers(data)[0]?.id ||
      '',
  );
  const [day, setDay] = useState(demoStamp(registrationNow()).slice(0, 10));
  const [time, setTime] = useState('');
  const [limit, setLimit] = useState(8);
  const [error, setError] = useState('');
  const at = demoStamp(registrationNow());
  const trainers = (assigned.length ? assigned : personalTrainers(data)).filter(
    (trainer) => trainer.club === club && (!selfBooking || trainer.id === user.id),
  );
  const trainer = trainers.find((row) => row.id === trainerId);
  const rooms = data.rooms.filter((room) => room.club === club && room.status !== 'В архиве');
  const [roomName, setRoomName] = useState('');
  const room =
    rooms.find((row) => row.name === roomName) ||
    rooms.find((row) => row.name === 'Зал персональных тренировок') ||
    rooms[0];
  const groups = nearestGroupEvents(data, club, at);
  const slots =
    trainer && room
      ? personalBookingSlots(data, user, member, trainer.id, club, day, room.name, at)
      : [];
  const bookGroup = (event: DemoRecord) => {
    if (!canOpenModule(user.role, 'registration')) return;
    const current = data.events.find((row) => row.id === event.id);
    if (!current) return setError('Занятие больше недоступно.');
    const reserved = rosterIds(current.attendees).length >= Number(current.capacity);
    const result = reserved
      ? changeReserve(current, member, 'join')
      : changeAttendance(current, member, 'book', data.events);
    if (typeof result === 'string') return setError(result);
    put('events', result);
    onBooked(result, reserved);
    onClose();
  };
  return (
    <Modal title="Записать клиента" subtitle={clientName(member)} size="wide" onClose={onClose}>
      <div className="modal-scroll-body">
        <div className="ws-stack client-booking-dialog">
          <Tabs
            items={selfBooking ? ['Персональные'] : ['Групповые', 'Персональные']}
            value={kind}
            onChange={(value) => {
              setKind(value);
              setError('');
            }}
            label="Направление записи"
          />
          <Field className="form-field" label={<> Клуб занятия </>}>
            <Select
              value={club}
              onChange={(event) => {
                const nextClub = event.target.value;
                setClub(nextClub);
                setTrainerId(
                  (assigned.length ? assigned : personalTrainers(data)).find(
                    (trainer) =>
                      trainer.club === nextClub && (!selfBooking || trainer.id === user.id),
                  )?.id || '',
                );
                setTime('');
                setRoomName('');
              }}
            >
              {data.clubs
                .filter((row) => row.status !== 'В архиве')
                .map((row) => (
                  <option key={row.id} value={row.name}>
                    {row.name}
                  </option>
                ))}
            </Select>
          </Field>
          {kind === 'Групповые' ? (
            <>
              <p className="form-note">
                Ближайшие занятия на 7 дней. Запись или резерв не списывают посещение.
              </p>
              {groups.length ? (
                groups.slice(0, limit).map((event) => {
                  const booked = rosterIds(event.attendees).includes(String(member.id));
                  const reserved = rosterIds(event.reserve).includes(String(member.id));
                  const free = Math.max(
                    0,
                    Number(event.capacity) - rosterIds(event.attendees).length,
                  );
                  return (
                    <div className="client-booking-option" key={event.id}>
                      <div>
                        <strong>{event.name}</strong>
                        <span>
                          {prettyDate(event.day)} · {event.time} · {event.trainer}
                        </span>
                        <span>
                          {event.room} ·{' '}
                          {free ? `Свободно мест: ${free}` : 'Мест нет — доступен резерв'}
                        </span>
                      </div>
                      <Button
                        variant="secondary"
                        disabled={booked || reserved}
                        onClick={() => bookGroup(event)}
                        aria-label={`${booked ? 'Уже записан' : reserved ? 'Уже в резерве' : free ? 'Записать' : 'В резерв'}: ${event.name}, ${event.day} ${event.time}`}
                      >
                        {booked
                          ? 'Уже записан'
                          : reserved
                            ? 'Уже в резерве'
                            : free
                              ? 'Записать'
                              : 'В резерв'}
                      </Button>
                    </div>
                  );
                })
              ) : (
                <Empty
                  title="Нет ближайших групповых занятий"
                  text="Выберите другой клуб или посмотрите расписание позднее."
                />
              )}
              {groups.length > limit && (
                <Button variant="ghost" onClick={() => setLimit((value) => value + 8)}>
                  Показать ещё занятия
                </Button>
              )}
            </>
          ) : (
            <form
              id={formId}
              className="ws-stack"
              onSubmit={(event) => {
                event.preventDefault();
                const result = createPersonalBooking(
                  data,
                  user,
                  member,
                  { id: demoId('personal'), trainerId, club, day, time, room: room?.name || '' },
                  demoStamp(registrationNow()),
                );
                if (typeof result === 'string') return setError(result);
                if (result.assignment) put('personal-clients', result.assignment);
                put('events', result.event);
                onBooked(result.event, false);
                onClose();
              }}
            >
              <Field className="form-field" label={<> Персональный тренер * </>}>
                <Select
                  required
                  value={trainerId}
                  onChange={(event) => {
                    setTrainerId(event.target.value);
                    setTime('');
                    setError('');
                  }}
                >
                  <option value="">Выберите тренера</option>
                  {trainers.map((trainer) => (
                    <option key={trainer.id} value={trainer.id}>
                      {trainer.name} · {trainer.category}
                    </option>
                  ))}
                </Select>
              </Field>
              {trainer && (
                <Notice>
                  {trainer.category} · {money(trainer.lessonPrice)} за занятие. Демо-тариф.
                  {!assigned.length && <p>После записи клиент будет закреплён за этим тренером.</p>}
                </Notice>
              )}
              {!trainers.length && (
                <Notice>
                  {selfBooking && assigned.length
                    ? 'Клиент закреплён за другим тренером. Для записи к себе сначала требуется изменить закрепление у руководителя.'
                    : 'В выбранном клубе нет подходящего закреплённого тренера. Выберите клуб его работы.'}
                </Notice>
              )}
              <div className="client-booking-fields">
                <Field className="form-field" label={<> Дата * </>}>
                  <input
                    type="date"
                    required
                    min={at.slice(0, 10)}
                    value={day}
                    onChange={(event) => {
                      setDay(event.target.value);
                      setTime('');
                    }}
                  />
                </Field>
                <Field className="form-field" label={<> Начало * </>}>
                  <input
                    type="time"
                    required
                    value={time}
                    onChange={(event) => setTime(event.target.value)}
                  />
                </Field>
                <Field className="form-field" label={<> Зал * </>}>
                  <Select
                    required
                    value={room?.name || ''}
                    onChange={(event) => {
                      setRoomName(event.target.value);
                      setTime('');
                    }}
                  >
                    {rooms.map((room) => (
                      <option key={room.id} value={room.name}>
                        {room.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <p className="form-note">
                50 минут. Проверяются занятость тренера, зала и записи клиента.
              </p>
              <div className="ws-actions">
                {slots.map((slot) => (
                  <Button
                    key={slot}
                    variant="secondary"
                    aria-pressed={time === slot}
                    onClick={() => setTime(slot)}
                  >
                    {slot}
                  </Button>
                ))}
              </div>
              {trainer && !slots.length && (
                <Notice>На выбранную дату нет доступных вариантов. Выберите другой день.</Notice>
              )}
            </form>
          )}
          {error && <p role="alert">{error}</p>}
        </div>
      </div>
      <div className="modal-actions">
        <Button variant="secondary" onClick={onClose}>
          {kind === 'Персональные' ? 'Отмена' : 'Готово'}
        </Button>
        {kind === 'Персональные' && (
          <Button form={formId} type="submit" disabled={!trainer || !time || !room}>
            Записать
          </Button>
        )}
      </div>
    </Modal>
  );
}
