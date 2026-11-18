import { Field } from './Field';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './ui';
import { reportMonth } from '../lib/report-period';

export function ReportMonthPicker({
  month,
  onChange,
  label = 'Месяц и год',
}: {
  month: string;
  onChange: (value: string) => void;
  label?: string;
}) {
  const choose = (value: string) => {
    if (reportMonth(value) && value >= '1900-01' && value <= '2100-12') onChange(value);
  };
  const move = (offset: number) => {
    const [year, number] = month.split('-').map(Number);
    const next = new Date(Date.UTC(year, number - 1 + offset, 1)).toISOString().slice(0, 7);
    if (next >= '1900-01' && next <= '2100-12') onChange(next);
  };
  return (
    <div className="report-month-picker" data-ui="report-month-picker">
      <Button
        variant="secondary"
        aria-label="Предыдущий месяц"
        disabled={month === '1900-01'}
        onClick={() => move(-1)}
      >
        <ChevronLeft size={20} />
      </Button>
      <Field className="form-field" label={<> {label} </>}>
        <input
          type="month"
          value={month}
          min="1900-01"
          max="2100-12"
          onInput={(event) => choose(event.currentTarget.value)}
          onChange={(event) => choose(event.target.value)}
        />
      </Field>
      <Button
        variant="secondary"
        aria-label="Следующий месяц"
        disabled={month === '2100-12'}
        onClick={() => move(1)}
      >
        <ChevronRight size={20} />
      </Button>
    </div>
  );
}
