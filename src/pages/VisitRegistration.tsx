import '../styles/registration.css';
import { clientCard, clientName, hiddenPhone } from '../lib/client-display';
import { useState } from 'react';
import type { DemoUser, Member, RegisterVisit } from '../types';
import type { Navigate } from '../components/WorkspaceUI';
import { Avatar, Button } from '../components/ui';
import { ClientBookingDialog } from '../components/ClientBookingDialog';
import { personalBooking } from '../lib/personal-training';
import { ClientSearch } from '../components/ClientSearch';
import { VisitPassList } from '../components/VisitPassList';
import { Empty, Notice } from '../components/WorkspaceUI';
import { demoId, useWorkspace } from '../components/WorkspaceProvider';
import { getClientProfile } from '../data/clientProfile';
import { membershipKinds } from '../data/membership-kinds';
import { TODAY } from '../data/workspace';
import {
  availableVisitPasses,
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
  hasHeaderSearch = false,
  user,
}: {
  members: Member[];
  initialMember: Member | null;
  clubName: string;
  onRegister: RegisterVisit;
  onMember: (member: Member) => void;
  navigate: Navigate;
  hidePhones?: boolean;
  hasHeaderSearch?: boolean;
  user: DemoUser;
}) {
  const { data, put, registerTrainingVisit } = useWorkspace();
  const [selected, setSelected] = useState<Member | null>(initialMember);
  const [passId, setPassId] = useState<string | null>(null);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [supervisionAcknowledged, setSupervisionAcknowledged] = useState(false);
  const [done, setDone] = useState(false);
  const [completedPassName, setCompletedPassName] = useState('');
  const [error, setError] = useState('');
  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingFeedback, setBookingFeedback] = useState('');
  const [feedbackEventId, setFeedbackEventId] = useState('');
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
  const bookings = selected
    ? registrationBookings(data.events, selected.id, club, now).map((event) =>
        personalBooking(event, data),
      )
    : [];
  const selectedBookingId = bookingId ?? (bookings.length === 1 ? bookings[0].id : '');
  const needsBookingChoice = bookingId === null && bookings.length > 1;
  const booking = bookings.find((event) => event.id === selectedBookingId);
  const bookingCategory = (data['trainer-categories'] || []).find(
    (row) => row.id === booking?.trainerCategory,
  )?.name;
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
  const availablePasses =
    needsBookingChoice || alreadyRegistered
      ? []
      : availableVisitPasses(passes, now, birthDate, booking);
  const recommended = recommendedPassIds(passes, booking, now, birthDate);
  const selectedPassId = passId ?? (availablePasses.length === 1 ? availablePasses[0].id : '');
  const pass = passes.find((pass) => pass.id === selectedPassId);
  const registerSelectedVisit = () => {
    if (!selected || !pass || done) return;
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
      if (booking) {
        const result = registerTrainingVisit({
          member: selected,
          eventId: booking.id,
          passId: pass.id,
          at: actualNow,
          acknowledged: supervisionAcknowledged,
        });
        onRegister(
          selected,
          booking.kind === 'personal' ? 'personal' : 'group',
          result.pass.name,
          result.pass.id,
          { at: actualNow, club: result.event.club, eventId: booking.id },
        );
      } else {
        const kind = membershipKinds.find((kind) => kind.id === pass.kindId);
        const issued = (data['issued-plans'] || []).find((row) => row.id === pass.id);
        put(
          'pass-usage',
          usePass(
            selected,
            pass,
            Number(issued?.duration || kind?.duration || 30),
            TODAY,
            actualNow.slice(11, 16),
            undefined,
            { acknowledged: supervisionAcknowledged },
          ),
        );
        onRegister(selected, 'gym', pass.name, pass.id);
        if (clientAge !== null && clientAge < 14)
          put('visit-supervision', {
            id: demoId('supervision'),
            memberId: String(selected.id),
            date: actualNow,
            type: 'Подтверждение администратора',
            trainer: '',
            acknowledged: String(supervisionAcknowledged),
          });
      }
      setPassId(pass.id);
      setCompletedPassName(pass.name);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Проверьте абонемент');
    }
  };
  const sellPass = () => {
    if (!selected) return;
    navigate(
      'services',
      selected,
      undefined,
      booking
        ? {
            saleTraining: booking.kind === 'personal' ? 'personal' : 'group',
            saleTrainerId: booking.kind === 'personal' ? booking.trainerId : undefined,
          }
        : undefined,
    );
  };
  const saleLabel = booking
    ? booking.kind === 'personal'
      ? 'Продать абонемент на персональные тренировки'
      : 'Продать абонемент на групповые занятия'
    : 'Продать абонемент';
  return (
    <div className="ws-stack registration-workspace">
      {!selected && !hasHeaderSearch && (
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
            <div className="registration-client-identity">
              <Avatar member={selected} portrait />
              <div>
                <h2>{clientName(selected)}</h2>
                <p>Карта {clientCard(selected)}</p>
                <p>
                  {hidePhones ? hiddenPhone(selected.phone) : selected.phone} · {clubName}
                </p>
              </div>
            </div>
            <div className="ws-actions">
              {!hasHeaderSearch && !done && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setSelected(null);
                    setSupervisionAcknowledged(false);
                    setPassId(null);
                    setBookingId(null);
                    setError('');
                  }}
                >
                  Другой клиент
                </Button>
              )}
              {!done && (
                <Button variant="secondary" onClick={() => setBookingOpen(true)}>
                  Записать
                </Button>
              )}
              <Button variant="secondary" onClick={() => onMember(selected)}>
                Карточка клиента
              </Button>
              {(done || availablePasses.length > 0) && (
                <Button variant="accent" onClick={() => navigate('services', selected)}>
                  Продать
                </Button>
              )}
            </div>
          </div>
          <div className="ws-panel-body ws-stack">
            {bookingFeedback && !done && (
              <Notice tone="success">
                <p>{bookingFeedback}</p>
                {feedbackEventId && (
                  <Button
                    variant="success"
                    disabled={
                      booking?.id !== feedbackEventId ||
                      alreadyRegistered ||
                      !availablePasses.length ||
                      !!supervisionProblem
                    }
                    onClick={() => {
                      if (pass) registerSelectedVisit();
                      else document.getElementById('visit-confirmation')?.focus();
                    }}
                  >
                    Отметить посещение
                  </Button>
                )}
              </Notice>
            )}
            {done ? (
              <Notice tone="success">
                Посещение зарегистрировано по абонементу «{completedPassName}». Оно появилось в
                журнале и карточке клиента.
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
                {!!bookings.length && (
                  <fieldset className="registration-bookings">
                    <legend>Клиент пришёл на занятие?</legend>
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
                    {booking && (
                      <p>
                        Тренер: {booking.trainer}
                        {bookingCategory ? ` · ${bookingCategory}` : ''} · {booking.room}
                      </p>
                    )}
                  </fieldset>
                )}
                {alreadyRegistered && (
                  <Notice>
                    Посещение по выбранной записи уже зарегистрировано. Повторного списания не
                    будет.
                  </Notice>
                )}
                {needsBookingChoice && (
                  <Notice>
                    Выберите предзапись или самостоятельное посещение, чтобы увидеть подходящие
                    абонементы.
                  </Notice>
                )}
                {!availablePasses.length && !alreadyRegistered && !needsBookingChoice && (
                  <div className="registration-no-pass" role="status">
                    <h3>
                      {booking
                        ? 'Нет подходящего абонемента для занятия'
                        : passes.length
                          ? 'Нет доступных сейчас абонементов'
                          : 'У клиента нет абонементов'}
                    </h3>
                    <p>
                      {booking
                        ? `Для записи «${booking.name}» нужен абонемент на ${booking.kind === 'personal' ? `персональные тренировки${bookingCategory ? ` категории «${bookingCategory}»` : ''}` : 'групповые занятия'}.`
                        : 'Можно продать абонемент и затем зарегистрировать посещение.'}
                    </p>
                    <Button onClick={sellPass}>{saleLabel}</Button>
                  </div>
                )}
                {availablePasses.length > 0 && (
                  <>
                    <div>
                      <h3>Выберите абонемент для посещения</h3>
                      <p className="form-note">
                        Время посещения: {now.split('T')[0].split('-').reverse().join('.')}{' '}
                        {now.slice(11)} · МСК. Условия карты проверяются перед списанием.
                      </p>
                    </div>
                    <VisitPassList
                      passes={availablePasses}
                      value={selectedPassId}
                      recommendedIds={recommended}
                      categoryNames={Object.fromEntries(
                        (data['trainer-categories'] || []).map((row) => [row.id, row.name]),
                      )}
                      onChange={(id) => {
                        setPassId(id);
                        setError('');
                      }}
                    />
                  </>
                )}

                {availablePasses.length > 0 && (
                  <div className="ws-actions">
                    <Button variant="secondary" onClick={() => onMember(selected)}>
                      Отмена
                    </Button>
                    <Button
                      id="visit-confirmation"
                      disabled={!pass || !!unavailable(pass) || !!supervisionProblem}
                      onClick={registerSelectedVisit}
                    >
                      Подтвердить посещение
                    </Button>
                  </div>
                )}
                {error && <p role="alert">{error}</p>}
              </>
            )}
          </div>
        </section>
      ) : (
        <Empty
          title={
            hasHeaderSearch
              ? 'Найдите клиента в поиске сверху'
              : 'Выберите клиента из результатов поиска'
          }
          text="По карте, ФИО или телефону. Затем выберите абонемент для посещения."
        />
      )}
      {selected && bookingOpen && (
        <ClientBookingDialog
          member={selected}
          initialKind={
            booking?.kind === 'personal' ||
            (!booking &&
              passes.some(
                (pass) => pass.kindId === 'personal' && !passUnavailable(pass, now, birthDate),
              ) &&
              !passes.some(
                (pass) => pass.kindId === 'group' && !passUnavailable(pass, now, birthDate),
              ))
              ? 'personal'
              : 'group'
          }
          user={user}
          clubName={clubName}
          onClose={() => setBookingOpen(false)}
          onBooked={(event, reserved) => {
            setFeedbackEventId(reserved ? '' : event.id);
            setBookingFeedback(
              `${reserved ? 'Клиент добавлен в резерв' : 'Клиент записан'}: ${event.name}, ${event.day.split('-').reverse().join('.')} в ${event.time}. Посещение пока не списано.`,
            );
            setBookingId(
              !reserved &&
                registrationBookings([event], selected.id, club, demoStamp(registrationNow()))
                  .length
                ? event.id
                : null,
            );
            setPassId(null);
            setError('');
          }}
        />
      )}
    </div>
  );
}
