import { clientName, hiddenPhone } from '../lib/client-display';
import { useState } from 'react';
import type { Member, VisitKind } from '../types';
import type { Navigate } from '../components/WorkspaceUI';
import { Button } from '../components/ui';
import { ClientSearch } from '../components/ClientSearch';
import { MembershipCard } from '../components/MembershipCard';
import { Empty, Notice } from '../components/WorkspaceUI';
import { demoId, useWorkspace } from '../components/WorkspaceProvider';
import { getClientProfile } from '../data/clientProfile';
import { membershipKinds, quantityLabel } from '../data/membership-kinds';
import { TODAY } from '../data/workspace';
import {
  accessWindowLabel,
  ageOnDate,
  minorVisitProblem,
  bookingPassProblem,
  passUnavailable,
  recommendedPassIds,
  registrationBookings,
  usePass,
} from '../lib/registration';
import { demoStamp, registrationNow } from '../lib/demo-clock';

export function RegistrationWorkspace({
  members,
  initialMember,
  clubName,
  onRegister,
  onMember,
  navigate,
  hidePhones = false,
}: {
  members: Member[];
  initialMember: Member | null;
  clubName: string;
  onRegister: (member: Member, kind: VisitKind, passName?: string, passId?: string) => void;
  onMember: (member: Member) => void;
  navigate: Navigate;
  hidePhones?: boolean;
}) {
  const { data, put } = useWorkspace();
  const [selected, setSelected] = useState<Member | null>(initialMember);
  const [passId, setPassId] = useState<string | null>(null);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [supervisionAcknowledged, setSupervisionAcknowledged] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const passes = selected
    ? getClientProfile(
        members.find((member) => member.id === selected.id) || selected,
        data,
      ).subscriptions.filter((pass) => pass.kindId)
    : [];
  const now = demoStamp(registrationNow());
  const birthDate = selected
    ? getClientProfile(members.find((member) => member.id === selected.id) || selected, data)
        .birthDate
    : '';
  const club = clubName.split(' · ').at(-1)!;
  const bookings = selected ? registrationBookings(data.events, selected.id, club, now) : [];
  const selectedBookingId = bookingId ?? (bookings.length === 1 ? bookings[0].id : '');
  const needsBookingChoice = bookingId === null && bookings.length > 1;
  const booking = bookings.find((event) => event.id === selectedBookingId);
  const clientAge = ageOnDate(birthDate, now.split('T')[0]);
  const trainerVerified =
    !!booking &&
    booking.kind === 'personal' &&
    data.employees.some(
      (employee) =>
        employee.name === booking.trainer &&
        employee.position?.toLocaleLowerCase('ru').includes('тренер') &&
        employee.status === 'Активен',
    );
  const supervisionProblem = minorVisitProblem(birthDate, now.split('T')[0], {
    trainerVerified,
    acknowledged: supervisionAcknowledged,
  });
  const alreadyRegistered =
    !!booking &&
    (data['visit-bookings'] || []).some(
      (row) => row.memberId === String(selected?.id) && row.eventId === booking.id,
    );
  const unavailable = (item: (typeof passes)[number]) =>
    passUnavailable(item, now, birthDate) ||
    (needsBookingChoice ? 'Выберите занятие или самостоятельное посещение' : null) ||
    bookingPassProblem(item, booking) ||
    (alreadyRegistered ? 'Посещение по этой записи уже зарегистрировано' : null);
  const availablePasses = passes.filter((pass) => !unavailable(pass));
  const recommended = recommendedPassIds(passes, booking, now, birthDate);
  const selectedPassId = passId ?? (availablePasses.length === 1 ? availablePasses[0].id : '');
  const pass = passes.find((pass) => pass.id === selectedPassId);
  return (
    <div className="ws-stack registration-workspace">
      {!selected && (
        <section className="panel ws-panel client-picker-panel">
          <div className="ws-panel-heading">
            <div>
              <h2>Найдите клиента</h2>
              <p>Телефон, ФИО или номер карты. Поиск не регистрирует посещение.</p>
            </div>
          </div>
          <div className="ws-panel-body">
            <ClientSearch
              hidePhones={hidePhones}
              mode="selection"
              members={members}
              onMember={(member) => {
                setSelected(member);
                setSupervisionAcknowledged(false);
                setPassId(null);
                setBookingId(null);
                setDone(false);
                setError('');
              }}
            />
          </div>
        </section>
      )}
      {selected ? (
        <section className="panel ws-panel">
          <div className="ws-panel-heading">
            <div>
              <h2>{clientName(selected)}</h2>
              <p>
                {hidePhones ? hiddenPhone(selected.phone) : selected.phone} · {clubName}
              </p>
            </div>
            <div className="ws-actions">
              <Button
                variant="ghost"
                onClick={() => {
                  setSelected(null);
                  setSupervisionAcknowledged(false);
                  setPassId(null);
                  setBookingId(null);
                  setDone(false);
                  setError('');
                }}
              >
                Другой клиент
              </Button>
              <Button variant="secondary" onClick={() => onMember(selected)}>
                Карточка клиента
              </Button>
              {!done && (
                <Button variant="secondary" onClick={() => navigate('services', selected)}>
                  Продать
                </Button>
              )}
            </div>
          </div>
          <div className="ws-panel-body ws-stack">
            {done ? (
              <Notice tone="success">
                Посещение зарегистрировано по абонементу «{pass?.name}». Оно появилось в журнале и
                карточке клиента.
              </Notice>
            ) : null}
            {!done && (
              <>
                {(clientAge === null || clientAge < 14) && (
                  <Notice tone="warning">
                    <strong>
                      {clientAge === null
                        ? 'Не указана дата рождения.'
                        : `Клиенту ${clientAge} лет — требуется сопровождение.`}
                    </strong>
                    {trainerVerified ? (
                      <p>
                        Есть запись к тренеру {booking?.trainer} в {booking?.time}.
                      </p>
                    ) : (
                      <>
                        <p>
                          До 14 лет занятия разрешены только с тренером или ответственным взрослым.
                        </p>
                        {clientAge !== null && (
                          <label className="registration-supervision-check">
                            <input
                              type="checkbox"
                              checked={supervisionAcknowledged}
                              onChange={(event) => setSupervisionAcknowledged(event.target.checked)}
                            />
                            Подтверждаю, что клиент будет заниматься с тренером или ответственным
                            взрослым
                          </label>
                        )}
                        {clientAge === null && (
                          <p>Укажите дату рождения в карточке клиента перед регистрацией.</p>
                        )}
                      </>
                    )}
                  </Notice>
                )}
                <div>
                  <h3>Выберите абонемент для посещения</h3>
                  <p className="form-note">
                    Время посещения: {now.split('T')[0].split('-').reverse().join('.')}{' '}
                    {now.slice(11)} · МСК. Условия карты проверяются перед списанием.
                  </p>
                </div>
                {!!bookings.length && (
                  <fieldset className="registration-bookings">
                    <legend>Клиент пришёл на занятие?</legend>
                    <p>
                      Предзапись учитывается за 60 минут до начала и 30 минут после начала.
                      Подходящие карты выделены.
                    </p>
                    <div className="ws-actions">
                      <Button
                        variant="secondary"
                        aria-pressed={!selectedBookingId && !needsBookingChoice}
                        onClick={() => {
                          setBookingId('');
                          setPassId(null);
                          setError('');
                        }}
                      >
                        Самостоятельное посещение
                      </Button>
                      {bookings.map((event) => (
                        <Button
                          key={event.id}
                          variant="secondary"
                          aria-pressed={selectedBookingId === event.id}
                          onClick={() => {
                            setBookingId(event.id);
                            setPassId(null);
                            setError('');
                          }}
                        >
                          {event.time} · {event.name} ·{' '}
                          {event.kind === 'personal' ? 'Персональная' : 'Групповая'}
                        </Button>
                      ))}
                    </div>
                  </fieldset>
                )}
                {alreadyRegistered && (
                  <Notice>
                    Посещение по выбранной записи уже зарегистрировано. Повторного списания не
                    будет.
                  </Notice>
                )}
                <div className="plastic-card-grid">
                  {passes.map((item) => {
                    const problem = unavailable(item);
                    const isRecommended = recommended.includes(item.id) && !problem;
                    return (
                      <div key={item.id}>
                        {booking && (
                          <span
                            className="registration-recommendation"
                            aria-hidden={!isRecommended}
                          >
                            {isRecommended ? 'Подходит к предзаписи' : ''}
                          </span>
                        )}
                        <button
                          className={`plastic-choice ${isRecommended ? 'is-recommended' : ''}`}
                          disabled={!!problem}
                          aria-pressed={selectedPassId === item.id}
                          onClick={() => {
                            setPassId(item.id);
                            setError('');
                          }}
                        >
                          <MembershipCard
                            compact
                            name={item.name}
                            kindId={item.kindId}
                            detail={
                              (problem ? 'Недоступен для этого посещения' : '') ||
                              (item.status === 'pending'
                                ? 'Активируется при посещении'
                                : 'Действует')
                            }
                            footer={
                              item.remaining === null
                                ? 'Безлимит посещений'
                                : `Осталось: ${quantityLabel(item.remaining, 'visit')}`
                            }
                          />
                        </button>
                        {accessWindowLabel(item) && (
                          <p className="pass-access-note">{accessWindowLabel(item)}</p>
                        )}
                        {item.ageMin && item.ageMax && (
                          <p className="pass-access-note">
                            Возраст {item.ageMin}–{item.ageMax} лет включительно
                          </p>
                        )}
                        {problem && (
                          <p className="pass-access-note pass-access-problem">{problem}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
                {!availablePasses.length && !alreadyRegistered && (
                  <Empty
                    title={
                      booking
                        ? 'Нет подходящего абонемента для занятия'
                        : 'Нет доступных сейчас абонементов'
                    }
                    text="Проверьте часы доступа и назначение карты. Можно продать новый абонемент."
                    action={<Button onClick={() => navigate('services', selected)}>Продать</Button>}
                  />
                )}
                <div className="ws-actions">
                  <Button variant="secondary" onClick={() => onMember(selected)}>
                    Отмена
                  </Button>
                  <Button
                    disabled={!pass || !!unavailable(pass) || !!supervisionProblem}
                    onClick={() => {
                      if (!pass || done) return;
                      try {
                        const actualNow = demoStamp(registrationNow());
                        if (
                          selectedBookingId &&
                          !registrationBookings(data.events, selected.id, club, actualNow).some(
                            (event) => event.id === selectedBookingId,
                          )
                        )
                          throw new Error(
                            'Предзапись изменилась или время занятия прошло. Выберите посещение заново.',
                          );
                        const problem = unavailable(pass);
                        if (problem) throw new Error(problem);
                        const kind = membershipKinds.find((kind) => kind.id === pass.kindId);
                        const issued = (data['issued-plans'] || []).find(
                          (row) => row.id === pass.id,
                        );
                        const usage = usePass(
                          selected,
                          pass,
                          Number(issued?.duration || kind?.duration || 30),
                          TODAY,
                          actualNow.slice(11, 16),
                          booking,
                          { trainerVerified, acknowledged: supervisionAcknowledged },
                        );
                        setPassId(pass.id);
                        put('pass-usage', usage);
                        onRegister(
                          selected,
                          booking
                            ? booking.kind === 'personal'
                              ? 'personal'
                              : 'group'
                            : kind?.id === 'group'
                              ? 'group'
                              : kind?.id === 'personal'
                                ? 'personal'
                                : 'gym',
                          pass.name,
                          pass.id,
                        );
                        if (booking)
                          put('visit-bookings', {
                            id: `${selected.id}:${booking.id}`,
                            memberId: String(selected.id),
                            eventId: booking.id,
                            passId: pass.id,
                            date: actualNow,
                          });
                        if (clientAge !== null && clientAge < 14)
                          put('visit-supervision', {
                            id: demoId('supervision'),
                            memberId: String(selected.id),
                            date: actualNow,
                            type: trainerVerified
                              ? 'Запись к тренеру'
                              : 'Подтверждение администратора',
                            trainer: trainerVerified ? booking?.trainer || '' : '',
                            acknowledged: String(supervisionAcknowledged),
                          });
                        setDone(true);
                      } catch (err) {
                        setError(err instanceof Error ? err.message : 'Проверьте абонемент');
                      }
                    }}
                  >
                    Подтвердить посещение
                  </Button>
                </div>
                {error && <p role="alert">{error}</p>}
              </>
            )}
            {done && (
              <div className="ws-actions">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSelected(null);
                    setSupervisionAcknowledged(false);
                    setPassId(null);
                    setBookingId(null);
                    setDone(false);
                    setError('');
                  }}
                >
                  Следующий клиент
                </Button>
                <Button variant="secondary" onClick={() => navigate('services', selected)}>
                  Продать
                </Button>
              </div>
            )}
          </div>
        </section>
      ) : (
        <Empty
          title="Выберите клиента из результатов поиска"
          text="Затем можно зарегистрировать посещение или перейти к продаже."
        />
      )}
    </div>
  );
}
