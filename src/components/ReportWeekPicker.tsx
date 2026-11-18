import { Field } from './Field';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './ui';
import { reportNextDay, reportWeek } from '../lib/report-period';

/** Choose a calendar week through any date inside it. Same controls as month reports. */
export function ReportWeekPicker({
  day,
  onChange,
}: {
  day: string;
  onChange: (day: string) => void;
}) {
  const choose = (value: string) => {
    if (reportWeek(value) && value >= '1900-01-01' && value <= '2100-12-31') onChange(value);
  };
  return (
    <div className="report-week-picker" data-ui="report-week-picker">
      <Button
        variant="secondary"
        aria-label="Предыдущая неделя"
        disabled={day < '1900-01-08'}
        onClick={() => choose(reportNextDay(day, -7))}
      >
        <ChevronLeft size={20} />
      </Button>
      <Field className="form-field" label={<> Неделя с датой </>}>
        <input
          type="date"
          value={day}
          min="1900-01-01"
          max="2100-12-31"
          onInput={(e) => choose(e.currentTarget.value)}
          onChange={(e) => choose(e.target.value)}
        />
      </Field>
      <Button
        variant="secondary"
        aria-label="Следующая неделя"
        disabled={day > '2100-12-24'}
        onClick={() => choose(reportNextDay(day, 7))}
      >
        <ChevronRight size={20} />
      </Button>
    </div>
  );
}
