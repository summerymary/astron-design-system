import { ArrowUpRight, Clock3 } from 'lucide-react';
import { IconButton } from './ui';

export function ReceptionShift({
  shift,
  onOpen,
}: {
  shift?: Record<string, string>;
  onOpen: () => void;
}) {
  return (
    <div className="reception-shift" aria-label="Моя смена">
      <Clock3 size={18} aria-hidden="true" />
      <span>Моя смена</span>
      <strong>
        {shift?.start && shift?.end
          ? `${shift.start.split('T')[1]}–${shift.end.split('T')[1]}`
          : 'Не запланирована'}
      </strong>
      <IconButton label="Рабочий день" title="Открыть рабочий день" onClick={onOpen}>
        <ArrowUpRight size={18} />
      </IconButton>
    </div>
  );
}
