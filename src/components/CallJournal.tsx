import type { Member } from '../types';
import type { DemoRecord } from '../data/workspace';
import { prettyDate } from '../data/workspace';
import { clientName, hiddenPhone } from '../lib/client-display';
import { displayDuration } from '../lib/display-format';
import { DataTable, Status } from './WorkspaceUI';
import { ClientLink, PhoneAction } from './RecordActions';

export function CallJournal({
  rows,
  members,
  hidePhones,
  onMember,
  onCall,
}: {
  rows: DemoRecord[];
  members: Member[];
  hidePhones: boolean;
  onMember: (member: Member) => void;
  onCall: (call: { name: string; phone: string }) => void;
}) {
  const memberOf = (row: DemoRecord) => members.find((m) => String(m.id) === row.memberId);
  return (
    <DataTable
      tableLabel="Журнал звонков"
      rows={rows}
      columns={[
        { key: 'time', label: 'Время', render: (r) => prettyDate(r.time) },
        { key: 'club', label: 'Клуб' },
        {
          key: 'name',
          label: 'Клиент',
          render: (r) => {
            const m = memberOf(r);
            return m ? (
              <ClientLink onClick={() => onMember(m)}>{clientName(m)}</ClientLink>
            ) : (
              r.name || 'Нет в базе'
            );
          },
        },
        {
          key: 'phone',
          label: 'Телефон клиента',
          render: (r) => {
            const phone = r.phone || memberOf(r)?.phone;
            return phone ? (
              <PhoneAction
                name={memberOf(r) ? clientName(memberOf(r)!) : r.name || 'Нет в базе'}
                phone={hidePhones ? hiddenPhone(phone) : phone}
                onClick={() =>
                  onCall({
                    name: memberOf(r) ? clientName(memberOf(r)!) : r.name || 'Нет в базе',
                    phone,
                  })
                }
              />
            ) : (
              '—'
            );
          },
        },
        { key: 'direction', label: 'Направление' },
        { key: 'status', label: 'Статус', render: (r) => <Status>{r.status}</Status> },
        { key: 'targetPhone', label: 'Номер клуба' },
        {
          key: 'duration',
          label: 'Длительность',
          render: (r) => displayDuration(r.duration),
        },
        {
          key: 'messenger',
          label: 'Мессенджер',
          render: (r) => r.messenger || (r.hasMessenger === 'true' ? 'Есть' : '—'),
        },
        {
          key: 'recording',
          label: 'Запись разговора',
          render: (r) =>
            r.recordingUrl?.startsWith('audio/') ? (
              <audio
                controls
                preload="none"
                src={new URL(r.recordingUrl, window.location.href.split('#')[0]).href}
                aria-label={`Запись звонка ${r.time}`}
              />
            ) : (
              'Нет записи'
            ),
        },
      ]}
    />
  );
}
