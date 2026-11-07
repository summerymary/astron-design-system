import { Eye, EyeOff, Star } from 'lucide-react';
import type { DemoRecord } from '../data/workspace';

export function AttentionFlags({
  record,
  onChange,
}: {
  record: DemoRecord;
  onChange: (row: DemoRecord) => void;
}) {
  return (
    <div className="attention-flags" aria-label="Отметки">
      <button
        type="button"
        aria-pressed={record.important === 'true'}
        onClick={() =>
          onChange({ ...record, important: record.important === 'true' ? 'false' : 'true' })
        }
      >
        <Star size={16} />
        {record.important === 'true' ? 'Важное' : 'Отметить важным'}
      </button>
      <button
        type="button"
        aria-pressed={record.unread === 'true'}
        onClick={() => onChange({ ...record, unread: record.unread === 'true' ? 'false' : 'true' })}
      >
        {record.unread === 'true' ? <EyeOff size={16} /> : <Eye size={16} />}
        {record.unread === 'true' ? 'Не просмотрено' : 'Отметить непросмотренным'}
      </button>
    </div>
  );
}
