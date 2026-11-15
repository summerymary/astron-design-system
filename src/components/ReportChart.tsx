import { useState } from 'react';
import { money } from '../data/workspace';
import type { StatisticsChart } from '../lib/statistics-charts';
import { Button } from './ui';
import { ReportBars } from './ReportBars';

export function ReportChart({ chart }: { chart: StatisticsChart }) {
  const [expanded, setExpanded] = useState(false);
  const format = (value: number | null) =>
    value === null
      ? '—'
      : chart.format === 'money'
        ? money(value / 100)
        : `${value.toLocaleString('ru-RU', { maximumFractionDigits: 1 })}${chart.format === 'percent' ? '%' : ''}`;
  const maximum = Math.max(
    1,
    chart.maximum ?? 0,
    chart.reference?.value ?? 0,
    ...chart.rows.flatMap((r) => r.values.filter((v): v is number => v !== null)),
  );
  const rows = expanded || chart.kind !== 'bars' ? chart.rows : chart.rows.slice(0, 12);
  const width = Math.max(360, chart.rows.length * (chart.kind === 'lines' ? 64 : 128));
  return (
    <section className="panel ws-panel-body ws-stack" data-ui="report-chart">
      <div className="ws-subheading">
        <h3>{chart.title}</h3>
        <span className="ws-muted">{chart.unit}</span>
      </div>
      {chart.kind !== 'bars' ? (
        <>
          {chart.reference && (
            <p className="report-chart-reference">
              {chart.reference.label}: <strong>{format(chart.reference.value)}</strong>
            </p>
          )}
          {chart.kind === 'lines' && (
            <div className="report-chart-legend">
              {chart.series.map((s, i) => (
                <span key={s.key}>
                  <svg width="28" height="16" aria-hidden="true">
                    <line
                      x1="0"
                      x2="28"
                      y1="8"
                      y2="8"
                      className={`report-chart-line report-chart-series-${i % 4}`}
                    />
                  </svg>
                  {s.label}
                </span>
              ))}
            </div>
          )}
          <div
            className="report-chart-scroll"
            tabIndex={0}
            role="region"
            aria-label={`${chart.title}: временная диаграмма`}
          >
            <svg
              className="report-columns"
              role="img"
              aria-label={chart.title}
              viewBox={`0 0 ${width} 240`}
              style={{ minWidth: width }}
            >
              <title>{chart.title}</title>
              <desc>
                {chart.rows
                  .map(
                    (r) =>
                      `${r.name}: ${r.values.map((v, i) => `${chart.series[i].label} ${format(v)}`).join(', ')}`,
                  )
                  .join('; ')}
                {chart.reference
                  ? `; ${chart.reference.label}: ${format(chart.reference.value)}`
                  : ''}
              </desc>
              <line x1="12" x2={width - 12} y1="200" y2="200" className="report-chart-axis" />
              <text x="12" y="190">
                0
              </text>
              {chart.kind === 'lines' &&
                chart.series.flatMap((s, i) => {
                  const segments: string[][] = [[]];
                  chart.rows.forEach((r, j) => {
                    const value = r.values[i];
                    if (value === null) {
                      if (segments.at(-1)!.length) segments.push([]);
                    } else
                      segments
                        .at(-1)!
                        .push(
                          `${((j + 0.5) * width) / chart.rows.length},${200 - (value / maximum) * 160}`,
                        );
                  });
                  return segments
                    .filter((points) => points.length)
                    .map((points, j) => (
                      <polyline
                        key={`${s.key}:${j}`}
                        points={points.join(' ')}
                        className={`report-chart-line report-chart-series-${i % 4}`}
                      />
                    ));
                })}
              {chart.reference && (
                <line
                  x1="12"
                  x2={width - 12}
                  y1={200 - (chart.reference.value / maximum) * 160}
                  y2={200 - (chart.reference.value / maximum) * 160}
                  className="report-chart-mean"
                />
              )}
              {chart.rows.map((row, i) => {
                const x = ((i + 0.5) * width) / chart.rows.length;
                const value = row.values[0];
                const height = value === null ? 0 : (value / maximum) * 160;
                return (
                  <g key={row.id}>
                    {chart.kind === 'columns' ? (
                      <rect
                        x={x - 18}
                        y={200 - height}
                        width="36"
                        height={height}
                        rx="3"
                        className="report-chart-column"
                      />
                    ) : (
                      row.values.map((v, j) =>
                        v === null ? null : (
                          <circle
                            key={chart.series[j].key}
                            cx={x}
                            cy={200 - (v / maximum) * 160}
                            r="3"
                            className={`report-chart-point report-chart-series-${j % 4}`}
                          >
                            <title>
                              {row.name} · {chart.series[j].label}: {format(v)}
                            </title>
                          </circle>
                        ),
                      )
                    )}
                    <text x={x} y={Math.max(24, 190 - height)} textAnchor="middle">
                      {format(value)}
                    </text>
                    <text x={x} y="228" textAnchor="middle">
                      {chart.kind === 'lines' ? row.name.slice(0, 5) : row.name}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </>
      ) : chart.series.length === 1 ? (
        <ReportBars
          maximum={maximum}
          unit={chart.unit}
          rows={rows.flatMap((r) =>
            r.values[0] === null
              ? []
              : [{ id: r.id, name: r.name, value: r.values[0], label: format(r.values[0]) }],
          )}
        />
      ) : (
        <div className="report-chart-groups">
          {rows.map((row) => (
            <div className="report-chart-group" role="group" aria-label={row.name} key={row.id}>
              <h4>{row.name}</h4>
              <ReportBars
                maximum={maximum}
                unit={chart.unit}
                rows={chart.series.flatMap((series, i) =>
                  row.values[i] === null
                    ? []
                    : [
                        {
                          id: series.key,
                          name: series.label,
                          value: row.values[i]!,
                          label: format(row.values[i]),
                        },
                      ],
                )}
              />
              {row.values.some((v) => v === null) && (
                <p className="ws-muted">
                  {chart.series
                    .filter((_, i) => row.values[i] === null)
                    .map((s) => `${s.label}: —`)
                    .join(' · ')}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
      {chart.kind === 'bars' && chart.rows.length > 12 && (
        <Button variant="secondary" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>
          {expanded ? 'Свернуть до 12 групп' : `Показать все группы · ${chart.rows.length}`}
        </Button>
      )}
      {chart.note && <p className="ws-muted">{chart.note}</p>}
    </section>
  );
}
