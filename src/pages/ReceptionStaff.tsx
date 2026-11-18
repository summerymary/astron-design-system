import { useState } from 'react';
import { Phone } from 'lucide-react';
import { ClientLink, PhoneAction } from '../components/RecordActions';
import type { DemoUser, Member } from '../types';
import type { DemoRecord } from '../data/workspace';
import { useWorkspace } from '../components/WorkspaceProvider';
import { personalTrainers } from '../lib/personal-training';
import { personalClients, isManagementRole } from '../lib/staff-rules';
import { clientCard, clientName, hiddenPhone } from '../lib/client-display';
import { Button, Modal } from '../components/ui';
import { CallDialog } from '../components/CallDialog';
import { ClientSearch } from '../components/ClientSearch';
import { ClientBookingDialog } from '../components/ClientBookingDialog';
import { Back, DataTable, Empty, Notice, SearchBox, Tabs } from '../components/WorkspaceUI';
import { Select } from '../components/Select';
import { TODAY } from '../data/workspace';
import { ReportMonthPicker } from '../components/ReportMonthPicker';
import { reportMonth, reportWeek } from '../lib/report-period';
import { ShiftTimeline, shiftDate } from '../components/ShiftTimeline';
import { ReportWeekPicker } from '../components/ReportWeekPicker';
import { ShiftEditor } from '../components/ShiftEditor';
import { shiftsOnDay, shiftHours, shiftPeriodHours } from '../lib/shifts';
import { shiftStaffColors, shiftStaffKey } from '../lib/shift-colors';
import type { CSSProperties } from 'react';

export function TrainerClientRoster({
  trainerId,
  user,
  members,
  onMember,
  onBook,
}: {
  trainerId: string;
  user: DemoUser;
  members: Member[];
  onMember: (member: Member) => void;
  onBook: (member: Member) => void;
}) {
  const { data } = useWorkspace();
  const [query, setQuery] = useState('');
  const [call, setCall] = useState<Member | null>(null);
  const clients = personalClients(data, members, trainerId);
  const hidePhones = user.role === 'administrator';
  return (
    <section className="ws-stack">
      <h3>Клиенты персонального тренера · {clients.length}</h3>
      <SearchBox value={query} onChange={setQuery} placeholder="ФИО клиента" />
      <DataTable
        rows={clients
          .filter((member) =>
            clientName(member).toLocaleLowerCase('ru').includes(query.toLocaleLowerCase('ru')),
          )
          .map((member) => ({
            id: String(member.id),
            name: clientName(member),
            card: clientCard(member),
            phone: hidePhones ? hiddenPhone(member.phone) : member.phone,
          }))}
        columns={[
          {
            key: 'name',
            label: 'Клиент',
            render: (row) => (
              <ClientLink
                onClick={() => onMember(clients.find((member) => String(member.id) === row.id)!)}
              >
                {row.name}
              </ClientLink>
            ),
          },
          {
            key: 'phone',
            label: 'Телефон',
            render: (row) => {
              const member = clients.find((m) => String(m.id) === row.id)!;
              return (
                <PhoneAction name={row.name} phone={row.phone} onClick={() => setCall(member)} />
              );
            },
          },
          {
            key: 'action',
            label: 'Действия',
            render: (row) => {
              const member = clients.find((member) => String(member.id) === row.id)!;
              return (
                <div className="ws-actions">
                  <Button variant="secondary" onClick={() => onBook(member)}>
                    Записать
                  </Button>
                </div>
              );
            },
          },
        ]}
        empty={<p>Закреплённых клиентов пока нет.</p>}
      />
      {call && (
        <CallDialog
          name={clientName(call)}
          phone={call.phone}
          hidden={hidePhones}
          onClose={() => setCall(null)}
        />
      )}
    </section>
  );
}

export function PersonalTrainingsWorkspace({
  initialMember,
  user,
  members,
  clubName,
  onMember,
  onRegistration,
  recordId,
  onRecord,
}: {
  initialMember?: Member | null;
  user: DemoUser;
  members: Member[];
  clubName: string;
  onMember: (member: Member) => void;
  onRegistration: (member: Member) => void;
  recordId: string | null;
  onRecord: (id: string | null) => void;
}) {
  const { data } = useWorkspace();
  const [club, setClub] = useState(clubName.split(' · ').at(-1)!);
  const [query, setQuery] = useState('');
  const [bookingTrainer, setBookingTrainer] = useState<string | null>(
    initialMember ? recordId : null,
  );
  const [bookingMember, setBookingMember] = useState<Member | null>(initialMember || null);
  const [bookedMember, setBookedMember] = useState<Member | null>(null);
  const [message, setMessage] = useState('');
  const all = personalTrainers(data);
  const trainer = all.find((row) => row.id === recordId);
  const begin = (id: string, member: Member | null = null) => {
    setBookingTrainer(id);
    setBookingMember(member);
  };
  const rows = all
    .filter(
      (row) =>
        row.club === club &&
        `${row.name} ${row.category}`
          .toLocaleLowerCase('ru')
          .includes(query.toLocaleLowerCase('ru')),
    )
    .map((row): DemoRecord => ({
      ...row,
      lessonPrice: String(row.lessonPrice),
      clients: String(personalClients(data, members, row.id).length),
    }));
  return (
    <div className="ws-stack" data-ui="personal-trainings">
      {message && (
        <Notice tone="success">
          <p>{message}</p>
          {bookedMember && (
            <Button variant="success" onClick={() => onRegistration(bookedMember)}>
              Отметить посещение
            </Button>
          )}
        </Notice>
      )}
      {trainer ? (
        <>
          <Back onClick={() => onRecord(null)}>Все тренеры</Back>
          <section className="panel ws-panel-body ws-stack">
            <h2>{trainer.name}</h2>
            <p>
              {trainer.category} · {trainer.club}
            </p>
            <Button onClick={() => begin(trainer.id)}>Записать клиента</Button>
            <TrainerClientRoster
              trainerId={trainer.id}
              user={user}
              members={members}
              onMember={onMember}
              onBook={(member) => begin(trainer.id, member)}
            />
          </section>
        </>
      ) : (
        <section className="panel ws-panel">
          <div className="ws-toolbar">
            <SearchBox value={query} onChange={setQuery} placeholder="Имя тренера или категория" />
            <Select
              aria-label="Клуб персональных тренировок"
              value={club}
              onChange={(event) => setClub(event.target.value)}
            >
              {data.clubs
                .filter((row) => row.status !== 'В архиве')
                .map((row) => (
                  <option key={row.id}>{row.name}</option>
                ))}
            </Select>
          </div>
          <DataTable
            rows={rows}
            columns={[
              { key: 'name', label: 'Тренер' },
              { key: 'category', label: 'Категория' },
              { key: 'clients', label: 'Клиентов' },
              {
                key: 'action',
                label: 'Запись',
                render: (row) => (
                  <Button variant="accent" onClick={() => begin(row.id)}>
                    Записать клиента
                  </Button>
                ),
              },
            ]}
            onOpen={(row) => onRecord(row.id)}
            empty={
              <Empty
                title="Тренеры не найдены"
                text="Измените поиск или выберите другой клуб. Рабочий клуб при этом не меняется."
              />
            }
          />
        </section>
      )}
      {bookingTrainer && !bookingMember && (
        <Modal
          title="Найти клиента для записи"
          subtitle={all.find((row) => row.id === bookingTrainer)?.name}
          onClose={() => setBookingTrainer(null)}
        >
          <div className="ws-stack">
            <ClientSearch
              mode="selection"
              purpose="занятия"
              members={members}
              hidePhones={user.role === 'administrator'}
              onMember={setBookingMember}
            />
            <Notice>
              Поиск по карте, ФИО или телефону. Запись будет создана после выбора времени.
            </Notice>
          </div>
        </Modal>
      )}
      {bookingTrainer && bookingMember && (
        <ClientBookingDialog
          key={`${bookingTrainer}:${bookingMember.id}`}
          member={bookingMember}
          initialKind="personal"
          initialTrainerId={bookingTrainer}
          user={user}
          clubName={`Астрон · ${all.find((row) => row.id === bookingTrainer)?.club || club}`}
          onClose={() => {
            setBookingTrainer(null);
            setBookingMember(null);
          }}
          onBooked={(event) => {
            setMessage(
              `Клиент ${clientName(bookingMember)} записан: ${event.day} в ${event.time}, ${event.trainer}.`,
            );
            setBookedMember(bookingMember);
          }}
        />
      )}
    </div>
  );
}

export function StaffContactsWorkspace({
  clubName,
  recordId,
  onRecord,
}: {
  clubName: string;
  recordId: string | null;
  onRecord: (id: string | null) => void;
}) {
  const { data } = useWorkspace();
  const [query, setQuery] = useState('');
  const [club, setClub] = useState(clubName.split(' · ').at(-1)!);
  const [call, setCall] = useState<DemoRecord | null>(null);
  const rows = data.employees.filter(
    (row) =>
      row.status === 'Активен' &&
      (club === 'Все клубы' || row.club === club) &&
      `${row.name} ${row.position}`.toLocaleLowerCase('ru').includes(query.toLocaleLowerCase('ru')),
  );
  const employee = data.employees.find((row) => row.id === recordId);
  const columns = [
    { key: 'name', label: 'Сотрудник' },
    { key: 'position', label: 'Должность' },
    { key: 'club', label: 'Клуб' },
    { key: 'phone', label: 'Рабочий телефон' },
    {
      key: 'action',
      label: 'Связаться',
      render: (row: DemoRecord) => (
        <Button variant="secondary" onClick={() => setCall(row)}>
          <Phone size={16} />
          Позвонить
        </Button>
      ),
    },
  ];
  return (
    <div className="ws-stack">
      {employee && <Back onClick={() => onRecord(null)}>Все сотрудники</Back>}
      <section className="panel ws-panel">
        {!employee && (
          <div className="ws-toolbar">
            <SearchBox value={query} onChange={setQuery} placeholder="Имя или должность" />
            <Select
              aria-label="Клуб сотрудников"
              value={club}
              onChange={(event) => setClub(event.target.value)}
            >
              <option>Все клубы</option>
              {data.clubs.map((row) => (
                <option key={row.id}>{row.name}</option>
              ))}
            </Select>
          </div>
        )}
        <DataTable rows={employee ? [employee] : rows} columns={columns} />
      </section>
      {call && <CallDialog name={call.name} phone={call.phone} onClose={() => setCall(null)} />}
    </div>
  );
}

export function ShiftScheduleWorkspace({ user, clubName }: { user: DemoUser; clubName: string }) {
  const { data } = useWorkspace();
  const [club, setClub] = useState(clubName.split(' · ').at(-1)!);
  const [reception, setReception] = useState('Ресепшен 01');
  const [day, setDay] = useState(TODAY);
  const [view, setView] = useState('week');
  const [editing, setEditing] = useState<DemoRecord | null>(null);
  const [details, setDetails] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const period = view === 'week' ? reportWeek(day)! : reportMonth(day.slice(0, 7))!;
  const canEdit = isManagementRole(user.role);
  const receptions = data.receptions.filter((row) => row.club === club && row.status === 'Активен');
  const locationRows = data.shifts.filter(
    (row) => row.club === club && (row.reception || 'Не указан') === reception,
  );
  const rows = locationRows.filter(
    (row) =>
      row.start.slice(0, 10) <= period.to &&
      row.end > `${period.from}T00:00` &&
      row.name.toLocaleLowerCase('ru').includes(query.toLocaleLowerCase('ru')),
  );
  const colors = shiftStaffColors(data.employees, data.shifts);
  const create = (date = day, workplace = 'Место 1', start = '06:30', end = '14:30') => {
    setDetails(null);
    setEditing({
      id: '',
      name: '',
      club,
      reception,
      workplace,
      start: `${date}T${start}`,
      end: `${date}T${end}`,
      status: 'Запланирована',
    });
  };
  const detailsRows = details ? shiftsOnDay(locationRows, details) : [];
  return (
    <div className="ws-stack">
      {message && <Notice tone="success">{message}</Notice>}
      <section className="panel ws-panel">
        <div className="ws-toolbar shift-schedule-toolbar">
          <div className="form-field">
            <span>Клуб</span>
            <Select
              aria-label="Клуб графика смен"
              value={club}
              onChange={(event) => {
                setClub(event.target.value);
                setReception(
                  data.receptions.find(
                    (row) => row.club === event.target.value && row.status === 'Активен',
                  )?.name || '',
                );
              }}
            >
              {data.clubs.map((row) => (
                <option key={row.id}>{row.name}</option>
              ))}
            </Select>
          </div>
          <div className="form-field">
            <span>Ресепшен</span>
            <Select
              aria-label="Ресепшен графика смен"
              value={reception}
              onChange={(event) => setReception(event.target.value)}
            >
              {receptions.map((row) => (
                <option key={row.id}>{row.name}</option>
              ))}
              {data.shifts.some((row) => row.club === club && !row.reception) && (
                <option>Не указан</option>
              )}
            </Select>
          </div>
          <div className="form-field shift-search-field">
            <span>Администратор</span>
            <SearchBox
              value={query}
              onChange={setQuery}
              placeholder="Имя или фамилия"
              label="Поиск сотрудника в графике смен"
            />
          </div>
          {canEdit && <Button onClick={() => create()}>Добавить смену</Button>}
        </div>
        <div className="shift-period-toolbar">
          <Tabs
            items={[
              { id: 'week', label: 'Неделя' },
              { id: 'month', label: 'Месяц' },
            ]}
            value={view}
            onChange={setView}
            label="Период графика смен"
            variant="segmented"
          />
          {view === 'week' ? (
            <ReportWeekPicker day={day} onChange={setDay} />
          ) : (
            <ReportMonthPicker
              month={day.slice(0, 7)}
              onChange={(month) => setDay(`${month}-01`)}
            />
          )}
          <span className="muted shift-period-caption">
            {shiftDate(period.from)} — {shiftDate(period.to)} · МСК
          </span>
        </div>
        <ShiftTimeline
          rows={rows}
          employees={data.employees}
          allShifts={data.shifts}
          from={period.from}
          to={period.to}
          onDay={setDetails}
        />
        <p className="shift-journal-help">
          Две дорожки — два рабочих места. Нажмите на день или смену, чтобы посмотреть подробности
          {canEdit ? ' и передать место следующему администратору' : ''}.
        </p>
      </section>
      {details && (
        <Modal title={`Смены · ${shiftDate(details)}`} onClose={() => setDetails(null)}>
          <div className="ws-stack">
            <p className="muted">
              {club} · {reception} ·{' '}
              {shiftPeriodHours(locationRows, details, details).toLocaleString('ru')} человеко-часов
            </p>
            {[
              'Место 1',
              'Место 2',
              ...(detailsRows.some(({ row }) => !row.workplace) ? ['Не указано'] : []),
            ].map((workplace) => (
              <section className="shift-day-detail" key={workplace}>
                <div className="ws-subheading">
                  <h3>{workplace}</h3>
                  {canEdit && (
                    <Button variant="secondary" onClick={() => create(details, workplace)}>
                      Добавить смену
                    </Button>
                  )}
                </div>
                {detailsRows
                  .filter(({ row }) => (row.workplace || 'Не указано') === workplace)
                  .map(({ row }) => (
                    <div
                      className="shift-detail-entry"
                      key={row.id}
                      style={
                        {
                          '--shift-staff-color': colors.get(shiftStaffKey(row, data.employees)),
                        } as CSSProperties
                      }
                    >
                      <div>
                        <strong>{row.name}</strong>
                        <p>
                          {row.start.slice(11, 16)}–{row.end.slice(11, 16)} ·{' '}
                          {shiftHours(row).toLocaleString('ru')} ч
                        </p>
                        <small className="muted">{row.status}</small>
                      </div>
                      {canEdit && (
                        <div className="shift-detail-actions">
                          <Button
                            variant="secondary"
                            onClick={() => {
                              setDetails(null);
                              setEditing(row);
                            }}
                          >
                            Изменить
                          </Button>
                          <Button
                            variant="secondary"
                            onClick={() => {
                              const start = row.end;
                              const finish = new Date(Date.parse(`${start}:00Z`) + 4 * 3600000)
                                .toISOString()
                                .slice(0, 16);
                              setDetails(null);
                              setEditing({
                                ...row,
                                id: '',
                                name: '',
                                employeeId: '',
                                start,
                                end: finish,
                                status: 'Запланирована',
                              });
                            }}
                          >
                            Передать место
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                {!detailsRows.some(({ row }) => (row.workplace || 'Не указано') === workplace) && (
                  <p className="muted">Смены не добавлены</p>
                )}
              </section>
            ))}
          </div>
        </Modal>
      )}
      {editing && canEdit && (
        <ShiftEditor
          key={editing.id + editing.start}
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={() => setMessage('Смена сохранена. График и часы обновлены.')}
        />
      )}
    </div>
  );
}
