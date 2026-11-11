import { Search, ArrowUpRight } from 'lucide-react';
import { Button } from '../components/ui';
import { useWorkspace } from '../components/WorkspaceProvider';
import { demoClubs } from '../data/roles';
import type { AdminSectionId } from '../data/admin';

export function AdminOverview({
  clubId,
  onAction,
}: {
  clubId: string;
  onAction: (id: AdminSectionId) => void;
}) {
  const { data } = useWorkspace();
  const shift = data.shifts.find(
    (row) => row.club === demoClubs.find((c) => c.id === clubId)?.shortName,
  );
  return (
    <div className="reception-focus">
      <section className="reception-ready" aria-label="Работа с клиентом">
        <Search size={32} aria-hidden="true" />
        <h2>Откройте карточку клиента</h2>
        <p>
          Введите или отсканируйте карту в поиске выше.
          <br />
          Также можно найти по ФИО или телефону.
        </p>
      </section>
      <div className="reception-shift-line">
        <span>
          Моя смена{' '}
          <strong>
            {shift ? `${shift.start.split('T')[1]}–${shift.end.split('T')[1]}` : 'Не запланирована'}
          </strong>
        </span>
        <Button variant="ghost" onClick={() => onAction('payroll')}>
          Рабочий день <ArrowUpRight size={14} />
        </Button>
      </div>
    </div>
  );
}
