import { useState } from 'react';
import { Phone } from 'lucide-react';
import type { DemoRecord } from '../data/workspace';
import type { Member } from '../types';
import { clientName } from '../lib/client-display';
import { Button } from '../components/ui';
import { CallDialog } from '../components/CallDialog';
import { useWorkspace } from '../components/WorkspaceProvider';
import { DataTable, SearchBox } from '../components/WorkspaceUI';
import { Select } from '../components/Select';
export function CallsWorkspace({
  members,
  onMember,
  hidePhones,
}: {
  members: Member[];
  onMember: (member: Member) => void;
  hidePhones: boolean;
}) {
  const { data } = useWorkspace();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('Все статусы');
  const [call, setCall] = useState<Member | null>(null);
  const memberOf = (id: string) => members.find((member) => String(member.id) === id);
  const rows = (data.calls || [])
    .map((row): DemoRecord => ({
      ...row,
      name: memberOf(row.memberId) ? clientName(memberOf(row.memberId)!) : row.name,
    }))
    .filter(
      (row) =>
        (status === 'Все статусы' || row.status === status) &&
        Object.values(row)
          .join(' ')
          .toLocaleLowerCase('ru')
          .includes(query.toLocaleLowerCase('ru')),
    );
  return (
    <section className="panel ws-panel">
      <div className="ws-toolbar">
        <SearchBox value={query} onChange={setQuery} placeholder="Клиент или запись звонка" />
        <Select
          aria-label="Статус звонка"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option>Все статусы</option>
          <option>Пропущен</option>
          <option>Завершён</option>
        </Select>
      </div>
      <DataTable
        rows={rows}
        columns={[
          { key: 'time', label: 'Время' },
          { key: 'direction', label: 'Направление' },
          {
            key: 'name',
            label: 'Клиент',
            render: (row) =>
              memberOf(row.memberId) ? (
                <button className="text-link" onClick={() => onMember(memberOf(row.memberId)!)}>
                  {row.name}
                </button>
              ) : (
                row.name
              ),
          },
          { key: 'status', label: 'Состояние' },
          {
            key: 'action',
            label: 'Связаться',
            render: (row) => (
              <Button
                variant="secondary"
                disabled={!memberOf(row.memberId)}
                onClick={() => setCall(memberOf(row.memberId)!)}
              >
                <Phone size={16} />
                Позвонить
              </Button>
            ),
          },
        ]}
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
