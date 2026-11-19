import { Field } from './Field';
import '../styles/client-booking.css';
import { useMemo, useRef, useState } from 'react';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import type { DemoUser, Member } from '../types';
import type { DemoRecord } from '../data/workspace';
import { money, prettyDate } from '../data/workspace';
import { demoStamp, registrationNow } from '../lib/demo-clock';
import { clientTrainers, personalTrainers } from '../lib/personal-training';
import {
  bookPersonalSlot,
  filterBookingEvents,
  nearestGroupEvents,
  nearestPersonalBookingSlots,
} from '../lib/client-booking';
import type { PersonalBookingSlot } from '../lib/client-booking';
import { changeAttendance, changeReserve, rosterIds } from '../lib/schedule-attendance';
import { canOpenModule } from '../lib/staff-rules';
import { clientName } from '../lib/client-display';
import { demoId, useWorkspace } from './WorkspaceProvider';
import { Button, Modal } from './ui';
import { Select } from './Select';
import { Empty, Notice, Tabs, SearchBox } from './WorkspaceUI';

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
  const { data, put, transact } = useWorkspace();
  const assigned = clientTrainers(data, member.id);
  const selfBooking = user.role === 'trainer';
  const [kind, setKind] = useState(
    selfBooking || initialKind === 'personal' ? 'Персональные' : 'Групповые',
  );
  const [club, setClub] = useState(clubName.split(' · ').at(-1)!);
  const [trainerId, setTrainerId] = useState((selfBooking ? user.id : initialTrainerId) || '');
  const [limit, setLimit] = useState(8);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const submitting = useRef(false);
  const at = demoStamp(registrationNow());
  const trainers = (assigned.length ? assigned : personalTrainers(data)).filter(
    (trainer) => trainer.club === club && (!selfBooking || trainer.id === user.id),
  );
  const trainer = trainers.find((row) => row.id === trainerId);
  const words = query
    .toLocaleLowerCase('ru')
    .replaceAll('ё', 'е')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const filteredTrainers = trainers.filter((row) =>
    words.every((word) =>
      `${row.name} ${row.category}`.toLocaleLowerCase('ru').replaceAll('ё', 'е').includes(word),
    ),
  );
  const groups = filterBookingEvents(nearestGroupEvents(data, club, at), query);
  const slots = useMemo(
    () => (trainer ? nearestPersonalBookingSlots(data, user, member, trainer.id, club, at) : []),
    [data, user, member, trainer, club, at],
  );
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
  const bookSlot = (slot: PersonalBookingSlot) => {
    if (!trainer || submitting.current) return;
    submitting.current = true;
    setError('');
    try {
      let booked: DemoRecord | undefined;
      const id = demoId('personal');
      transact((previous) => {
        const result = bookPersonalSlot(
          previous,
          user,
          member,
          { ...slot, id, trainerId: trainer.id, club },
          demoStamp(registrationNow()),
        );
        booked = result.event;
        return result.data;
      });
      if (booked) {
        onBooked(booked, false);
        onClose();
      }
    } catch (cause) {
      submitting.current = false;
      setError(cause instanceof Error ? cause.message : 'Не удалось записать клиента.');
    }
  };
  const resetTrainer = () => {
    setTrainerId('');
    setQuery('');
    setLimit(8);
    setError('');
  };
  return (
    <Modal title="Записать клиента" subtitle={clientName(member)} size="wide" onClose={onClose}>
      <div className="client-booking-controls ws-stack">
        <Tabs
          items={selfBooking ? ['Персональные'] : ['Групповые', 'Персональные']}
          value={kind}
          label="Направление записи"
          onChange={(value) => {
            setKind(value);
            setQuery('');
            setLimit(8);
            setError('');
          }}
        />
        <Field className="form-field" label="Клуб занятия">
          <Select
            value={club}
            onChange={(event) => {
              setClub(event.target.value);
              resetTrainer();
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
        {(kind === 'Групповые' || !trainer) && (
          <SearchBox
            value={query}
            onChange={(value) => {
              setQuery(value);
              setLimit(8);
            }}
            label={kind === 'Групповые' ? 'Поиск занятия' : 'Поиск тренера'}
            placeholder={
              kind === 'Групповые'
                ? 'Занятие, тренер, зал, дата или время'
                : 'Имя или категория тренера'
            }
          />
        )}
        {kind === 'Персональные' && trainer && (
          <div className="booking-selected-trainer">
            <div>
              <strong>{trainer.name}</strong>
              <p className="ws-muted">
                {trainer.category} · {money(trainer.lessonPrice)} · 50 минут
              </p>
            </div>
            <Button variant="ghost" onClick={resetTrainer}>
              <ArrowLeft size={16} />
              Другой тренер
            </Button>
          </div>
        )}
      </div>
      <div
        className="modal-scroll-body"
        tabIndex={0}
        role="region"
        aria-label={
          kind === 'Групповые'
            ? 'Результаты поиска занятий'
            : trainer
              ? 'Свободные слоты тренера'
              : 'Результаты поиска тренеров'
        }
      >
        <div className="ws-stack client-booking-dialog">
          {kind === 'Групповые' ? (
            <>
              <p className="form-note">
                Ближайшие занятия на 7 дней. Запись или резерв не списывают посещение.
              </p>
              <p className="sr-only" role="status">
                Найдено занятий: {groups.length}
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
                  title={query.trim() ? 'Занятия не найдены' : 'Нет ближайших групповых занятий'}
                  text={
                    query.trim()
                      ? 'Измените запрос или выберите другой клуб. Поиск охватывает ближайшие семь дней.'
                      : 'Выберите другой клуб или посмотрите расписание позднее.'
                  }
                  action={
                    query.trim() ? (
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setQuery('');
                          setLimit(8);
                        }}
                      >
                        Сбросить поиск
                      </Button>
                    ) : undefined
                  }
                />
              )}
              {groups.length > limit && (
                <Button variant="ghost" onClick={() => setLimit((value) => value + 8)}>
                  Показать ещё занятия
                </Button>
              )}
            </>
          ) : trainer ? (
            <>
              <p className="form-note">
                Ближайшие свободные слоты на 7 дней. Нажмите на время, чтобы записать клиента.
                Посещение с абонемента не списывается.
              </p>
              {!assigned.length && (
                <Notice>При записи клиент будет закреплён за {trainer.name}.</Notice>
              )}
              {slots.length ? (
                <>
                  {[...new Set(slots.slice(0, limit).map((slot) => slot.day))].map((day) => (
                    <section
                      className="booking-slot-day"
                      key={day}
                      aria-label={`Свободное время ${prettyDate(day)}`}
                    >
                      <h3>{prettyDate(day)}</h3>
                      <div className="booking-slot-grid">
                        {slots
                          .slice(0, limit)
                          .filter((slot) => slot.day === day)
                          .map((slot) => (
                            <button
                              type="button"
                              className="booking-slot"
                              key={`${slot.day}T${slot.time}`}
                              aria-label={`Записать: ${trainer.name}, ${prettyDate(slot.day)} в ${slot.time}, ${slot.room}`}
                              onClick={() => bookSlot(slot)}
                            >
                              <strong>{slot.time}</strong>
                              <span>{slot.room}</span>
                              <span className="booking-slot-action" aria-hidden="true">
                                Записать
                              </span>
                            </button>
                          ))}
                      </div>
                    </section>
                  ))}
                  {slots.length > limit && (
                    <Button variant="ghost" onClick={() => setLimit((value) => value + 12)}>
                      Показать ещё слоты
                    </Button>
                  )}
                </>
              ) : (
                <Empty
                  title="Свободных слотов пока нет"
                  text="На ближайшие 7 дней нет подходящего времени по заданному рабочему расписанию. Выберите другого тренера или клуб."
                />
              )}
            </>
          ) : (
            <>
              <p className="form-note">
                Выберите тренера — откроются его ближайшие свободные слоты.
              </p>
              <div className="booking-trainer-grid">
                {filteredTrainers.map((row) => (
                  <button
                    type="button"
                    className="booking-trainer-card"
                    key={row.id}
                    aria-label={`Выбрать тренера: ${row.name}`}
                    onClick={() => {
                      setTrainerId(row.id);
                      setLimit(12);
                      setError('');
                    }}
                  >
                    <span>
                      <strong>{row.name}</strong>
                      <small>
                        {row.category} · {money(row.lessonPrice)} за 50 минут
                      </small>
                      {assigned.some((item) => item.id === row.id) && <small>Тренер клиента</small>}
                    </span>
                    <ChevronRight size={20} />
                  </button>
                ))}
              </div>
              {!filteredTrainers.length && (
                <Empty
                  title={query.trim() ? 'Тренер не найден' : 'Нет доступных тренеров'}
                  text={
                    query.trim()
                      ? 'Проверьте имя или категорию. Поиск учитывает выбранный клуб и закрепление клиента.'
                      : 'Выберите клуб работы тренера. Существующее закрепление клиента сохраняется.'
                  }
                  action={
                    query.trim() ? (
                      <Button variant="secondary" onClick={() => setQuery('')}>
                        Сбросить поиск
                      </Button>
                    ) : undefined
                  }
                />
              )}
            </>
          )}
          {error && (
            <p className="ws-error" role="alert">
              {error}
            </p>
          )}
        </div>
      </div>
      <div className="modal-actions">
        <Button variant="secondary" onClick={onClose}>
          Готово
        </Button>
      </div>
    </Modal>
  );
}
