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
  const left = Math.max(48, Math.min(140, format(maximum).length * 8 + 12));
  const width = Math.max(360, chart.rows.length * (chart.kind === 'lines' ? 32 : 128) + left + 16);
  const plotWidth = width - left - 16;
  const xAt = (index: number) => left + ((index + 0.5) * plotWidth) / chart.rows.length;
  return (
    <section className="panel ws-panel-body ws-stack" data-ui="report-chart">
      <div className="ws-subheading">
        <h3>{chart.title}</h3>
        <span className="ws-muted">{chart.unit}</span>
      </div>
      {chart.kind === 'pyramid' ? (
        <ReportPyramid chart={chart} />
      ) : chart.kind === 'donut' ? (
        <ReportDonut chart={chart} />
      ) : chart.kind !== 'bars' ? (
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
              {[0, 0.5, 1].map((part) => (
                <g key={part}>
                  <line
                    x1={left}
                    x2={width - 16}
                    y1={200 - part * 160}
                    y2={200 - part * 160}
                    className="report-chart-axis"
                  />
                  <text x={left - 8} y={205 - part * 160} textAnchor="end">
                    {format(maximum * part)}
                  </text>
                </g>
              ))}
              {chart.kind === 'lines' &&
                chart.series.flatMap((s, i) => {
                  const segments: string[][] = [[]];
                  chart.rows.forEach((r, j) => {
                    const value = r.values[i];
                    if (value === null) {
                      if (segments.at(-1)!.length) segments.push([]);
                    } else segments.at(-1)!.push(`${xAt(j)},${200 - (value / maximum) * 160}`);
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
                  x1={left}
                  x2={width - 16}
                  y1={200 - (chart.reference.value / maximum) * 160}
                  y2={200 - (chart.reference.value / maximum) * 160}
                  className="report-chart-mean"
                />
              )}
              {chart.rows.map((row, i) => {
                const x = xAt(i);
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
                    {chart.kind === 'columns' && (
                      <text x={x} y={Math.max(24, 190 - height)} textAnchor="middle">
                        {format(value)}
                      </text>
                    )}
                    <text x={x} y="228" textAnchor="middle">
                      {chart.kind === 'lines' ? row.name.slice(0, 2) : row.name}
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

function ReportDonut({ chart }: { chart: StatisticsChart }) {
  const rows = chart.rows.filter((row) => (row.values[0] ?? 0) > 0);
  const total = rows.reduce((sum, row) => sum + row.values[0]!, 0);
  const circumference = 2 * Math.PI * 76;
  let position = 0;
  return (
    <div className="report-donut">
      <svg viewBox="0 0 220 220" role="img" aria-label={`${chart.title}: всего ${total}`}>
        <title>{chart.title}</title>
        <desc>
          {rows
            .map(
              (row) =>
                `${row.name}: ${row.values[0]} (${((row.values[0]! * 100) / total).toFixed(1)}%)`,
            )
            .join('; ')}
        </desc>
        {rows.map((row, index) => {
          const length = (row.values[0]! / total) * circumference;
          const offset = -position;
          position += length;
          return (
            <circle
              key={row.id}
              cx="110"
              cy="110"
              r="76"
              className={`report-donut-segment report-donut-tone-${index % 4}`}
              strokeDasharray={`${length} ${circumference - length}`}
              strokeDashoffset={offset}
              transform="rotate(-90 110 110)"
            />
          );
        })}
        <text x="110" y="106" textAnchor="middle" className="report-donut-total">
          {total.toLocaleString('ru-RU')}
        </text>
        <text x="110" y="131" textAnchor="middle" className="report-donut-caption">
          клиентов
        </text>
      </svg>
      <ul aria-label="Распределение клиентов">
        {rows.map((row, index) => (
          <li key={row.id}>
            <span
              className={`report-donut-key report-donut-tone-${index % 4}`}
              aria-hidden="true"
            />
            <span>{row.name}</span>
            <strong>
              {row.values[0]} ·{' '}
              {((row.values[0]! * 100) / total).toLocaleString('ru-RU', {
                maximumFractionDigits: 1,
              })}
              %
            </strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ReportPyramid({ chart }: { chart: StatisticsChart }) {
  const maximum = Math.max(1, ...chart.rows.flatMap((row) => row.values.map((v) => v ?? 0)));
  return (
    <div
      className="report-chart-scroll"
      role="region"
      tabIndex={0}
      aria-label={`${chart.title}: зеркальная диаграмма`}
    >
      <div className="report-pyramid">
        <div className="report-pyramid-heading">
          <span>Мужчины</span>
          <span>Возраст</span>
          <span>Женщины</span>
        </div>
        {chart.rows.map((row) => (
          <div className="report-pyramid-row" key={row.id}>
            <div className="report-pyramid-side report-pyramid-male">
              <span>{row.values[0]?.toLocaleString('ru-RU') ?? '—'}</span>
              <div className="report-pyramid-track">
                <i
                  aria-hidden="true"
                  style={{ width: `${((row.values[0] ?? 0) * 100) / maximum}%` }}
                />
              </div>
            </div>
            <span>{row.name}</span>
            <div className="report-pyramid-side report-pyramid-female">
              <div className="report-pyramid-track">
                <i
                  aria-hidden="true"
                  style={{ width: `${((row.values[1] ?? 0) * 100) / maximum}%` }}
                />
              </div>
              <span>{row.values[1]?.toLocaleString('ru-RU') ?? '—'}</span>
            </div>
          </div>
        ))}
        <p className="ws-muted">
          Общая шкала: 0–{maximum.toLocaleString('ru-RU')} · {chart.unit.toLowerCase()}
        </p>
      </div>
    </div>
  );
}
