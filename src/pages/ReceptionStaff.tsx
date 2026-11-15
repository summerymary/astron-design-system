import { useState } from 'react';
import { Phone } from 'lucide-react';
import type { DemoUser, Member } from '../types';
import type { DemoRecord } from '../data/workspace';
import { demoId, useWorkspace } from '../components/WorkspaceProvider';
import { personalTrainers } from '../lib/personal-training';
import { personalClients, isManagementRole } from '../lib/staff-rules';
import { clientCard, clientName, hiddenPhone } from '../lib/client-display';
import { Button, Modal } from '../components/ui';
import { CallDialog } from '../components/CallDialog';
import { ClientSearch } from '../components/ClientSearch';
import { ClientBookingDialog } from '../components/ClientBookingDialog';
import { Back, DataTable, Empty, Notice, RecordForm, SearchBox } from '../components/WorkspaceUI';
import { Select } from '../components/Select';
import { TODAY } from '../data/workspace';
import { addDays, weekStart } from '../lib/schedule';

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
              <button
                className="text-link"
                onClick={() => onMember(clients.find((member) => String(member.id) === row.id)!)}
              >
                {row.name}
              </button>
            ),
          },
          { key: 'phone', label: 'Телефон' },
          {
            key: 'action',
            label: 'Действия',
            render: (row) => {
              const member = clients.find((member) => String(member.id) === row.id)!;
              return (
                <div className="ws-actions">
                  <Button variant="secondary" onClick={() => setCall(member)}>
                    <Phone size={16} />
                    Позвонить
                  </Button>
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
  const { data, put } = useWorkspace();
  const [club, setClub] = useState(clubName.split(' · ').at(-1)!);
  const [day, setDay] = useState(TODAY);
  const [editing, setEditing] = useState<DemoRecord | 'new' | null>(null);
  const [query, setQuery] = useState('');
  const start = weekStart(day),
    end = addDays(start, 6);
  const canEdit = isManagementRole(user.role);
  const rows = data.shifts
    .filter(
      (row) =>
        row.club === club &&
        row.start.slice(0, 10) >= start &&
        row.start.slice(0, 10) <= end &&
        row.name.toLocaleLowerCase('ru').includes(query.toLocaleLowerCase('ru')),
    )
    .sort((a, b) => a.start.localeCompare(b.start));
  return (
    <div className="ws-stack">
      <section className="panel ws-panel">
        <div className="ws-toolbar">
          <SearchBox value={query} onChange={setQuery} placeholder="Сотрудник" />
          <Select
            aria-label="Клуб графика смен"
            value={club}
            onChange={(event) => setClub(event.target.value)}
          >
            {data.clubs.map((row) => (
              <option key={row.id}>{row.name}</option>
            ))}
          </Select>
          <label className="form-field">
            <span>Неделя</span>
            <input type="date" value={day} onChange={(event) => setDay(event.target.value)} />
          </label>
          {canEdit && <Button onClick={() => setEditing('new')}>Добавить смену</Button>}
        </div>
        <div className="ws-panel-body">
          <p>
            {start} — {end}
          </p>
        </div>
        <DataTable
          rows={rows}
          columns={[
            { key: 'name', label: 'Сотрудник' },
            { key: 'start', label: 'Начало' },
            { key: 'end', label: 'Окончание' },
            { key: 'status', label: 'Состояние' },
          ]}
          onOpen={canEdit ? setEditing : undefined}
          empty={
            <Empty
              title="Смены на эту неделю не добавлены"
              text="Выберите другую неделю или клуб."
            />
          }
        />
      </section>
      {editing && canEdit && (
        <RecordForm
          title={editing === 'new' ? 'Добавить смену' : 'Изменить смену'}
          initial={editing === 'new' ? undefined : editing}
          fields={[
            {
              key: 'name',
              label: 'Сотрудник',
              required: true,
              options: data.employees
                .filter((row) => row.status === 'Активен')
                .map((row) => row.name),
            },
            { key: 'start', label: 'Начало', type: 'datetime-local', required: true },
            { key: 'end', label: 'Окончание', type: 'datetime-local', required: true },
            {
              key: 'status',
              label: 'Состояние',
              options: ['Запланирована', 'На проверке', 'Подтверждено'],
            },
          ]}
          onClose={() => setEditing(null)}
          onSave={(record) => {
            if (record.end <= record.start) return 'Окончание смены должно быть позже начала.';
            if (
              data.shifts.some(
                (row) =>
                  row.id !== record.id &&
                  row.name === record.name &&
                  row.start < record.end &&
                  row.end > record.start,
              )
            )
              return 'У сотрудника уже есть смена в это время.';
            put('shifts', {
              ...record,
              id: record.id || demoId('shift'),
              club,
              hours: String((Date.parse(record.end) - Date.parse(record.start)) / 3600000),
              rate: '250',
            });
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
