/** A comparison with a controlled visual track and accessible meter values. */
export function ReportBars({
  rows,
  unit = '',
  maximum,
}: {
  rows: { id?: string; name: string; value: number; label: string }[];
  unit?: string;
  maximum?: number;
}) {
  const max = Math.max(1, maximum ?? 0, ...rows.map((r) => r.value));
  return (
    <div className="report-bars" data-ui="report-bars" aria-label={`Сравнение: ${unit}`}>
      {rows.map((row, index) => (
        <div key={row.id || `${row.name}-${index}`}>
          <span>{row.name}</span>
          <div
            className="report-bar-track"
            role="meter"
            aria-valuemin={0}
            aria-valuemax={max}
            aria-valuenow={row.value}
            aria-valuetext={row.label}
            aria-label={row.name}
          >
            <span
              className="report-bar-fill"
              aria-hidden="true"
              style={{ width: `${(Math.max(0, row.value) * 100) / max}%` }}
            />
          </div>
          <strong>{row.label}</strong>
        </div>
      ))}
    </div>
  );
}
