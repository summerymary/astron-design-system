import { CallJournal } from '../components/CallJournal';
import { useState } from 'react';

import type { DemoRecord } from '../data/workspace';
import type { Member } from '../types';
import { clientName } from '../lib/client-display';

import { CallDialog } from '../components/CallDialog';
import { useWorkspace } from '../components/WorkspaceProvider';
import { SearchBox } from '../components/WorkspaceUI';
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
  const [call, setCall] = useState<{ name: string; phone: string } | null>(null);
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
      <CallJournal
        rows={rows}
        members={members}
        onMember={onMember}
        hidePhones={hidePhones}
        onCall={setCall}
      />
      {call && (
        <CallDialog
          name={call.name}
          phone={call.phone}
          hidden={hidePhones}
          onClose={() => setCall(null)}
        />
      )}
    </section>
  );
}
