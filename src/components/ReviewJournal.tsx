import type { Member } from '../types';
import type { DemoRecord } from '../data/workspace';
import { prettyDate } from '../data/workspace';
import { clientName } from '../lib/client-display';
import { DataTable } from './WorkspaceUI';
import { ClientLink } from './RecordActions';

export function ReviewJournal({
  rows,
  members,
  onMember,
  showClient = true,
}: {
  rows: DemoRecord[];
  members: Member[];
  onMember?: (member: Member) => void;
  showClient?: boolean;
}) {
  return (
    <DataTable
      tableLabel="Отзывы клиентов"
      rows={rows}
      columns={[
        { key: 'date', label: 'Дата', render: (r) => prettyDate(r.date) },
        ...(showClient
          ? [
              {
                key: 'name',
                label: 'Клиент',
                render: (r: DemoRecord) => {
                  const m = members.find((m) => String(m.id) === r.memberId);
                  return m && onMember ? (
                    <ClientLink onClick={() => onMember(m)}>{clientName(m)}</ClientLink>
                  ) : m ? (
                    clientName(m)
                  ) : (
                    r.name || 'Не определён'
                  );
                },
              },
            ]
          : []),
        { key: 'club', label: 'Клуб' },
        { key: 'text', label: 'Отзыв' },
        { key: 'operator', label: 'Сотрудник' },
        { key: 'rating', label: 'Оценка' },
      ]}
    />
  );
}
