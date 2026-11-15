/** A compact comparison; the exact values remain readable without colour or graphics. */
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
          <meter min={0} max={max} value={row.value} aria-label={`${row.name}: ${row.label}`} />
          <strong>{row.label}</strong>
        </div>
      ))}
    </div>
  );
}
