import { ArrowUpRight, Clock3 } from 'lucide-react';
import { useWorkspace } from './WorkspaceProvider';
import { IconButton } from './ui';
import { demoClubs } from '../data/roles';

export function ReceptionShift({ clubId, onOpen }: { clubId: string; onOpen: () => void }) {
  const { data } = useWorkspace();
  const shift = data.shifts.find(
    (row) => row.club === demoClubs.find((club) => club.id === clubId)?.shortName,
  );
  return (
    <div className="reception-shift" aria-label="Моя смена">
      <Clock3 size={18} aria-hidden="true" />
      <span>Моя смена</span>
      <strong>
        {shift ? `${shift.start.split('T')[1]}–${shift.end.split('T')[1]}` : 'Не запланирована'}
      </strong>
      <IconButton label="Рабочий день" title="Открыть рабочий день" onClick={onOpen}>
        <ArrowUpRight size={18} />
      </IconButton>
    </div>
  );
}
