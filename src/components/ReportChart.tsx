import { useEffect, useRef, useState } from 'react';
import { money } from '../data/workspace';
import type { StatisticsChart } from '../lib/statistics-charts';
import { chartTone, chartScale, chartValueState, chartCategory } from '../lib/chart-display';
import { Button } from './ui';
import { ReportBars } from './ReportBars';

export function ReportChart({ chart }: { chart: StatisticsChart }) {
  const [expanded, setExpanded] = useState(false);
  const format = (value: number | null) =>
    value === null
      ? '—'
      : chart.format === 'money'
        ? money(Math.round(value) / 100)
        : `${value.toLocaleString('ru-RU', { maximumFractionDigits: 1 })}${chart.format === 'percent' ? '%' : ''}`;
  const maximum = Math.max(
    1,
    chart.maximum ?? 0,
    chart.reference?.value ?? 0,
    ...chart.rows.flatMap((r) => r.values.filter((v): v is number => v !== null)),
  );
  const rows = expanded || chart.kind !== 'bars' ? chart.rows : chart.rows.slice(0, 12);
  const valueState = chartValueState(chart.rows.flatMap((r) => r.values));
  const allZero = valueState !== 'known';
  return (
    <section
      className="panel ws-panel-body ws-stack"
      data-ui="report-chart"
      data-chart-kind={chart.kind}
    >
      <div className="ws-subheading">
        <h3>{chart.title}</h3>
        <span className="ws-muted">{chart.unit}</span>
      </div>
      {allZero ? (
        <p className="ws-muted">
          {valueState === 'unknown'
            ? 'Нет известных значений для диаграммы. Неизвестные данные показаны прочерками в таблице.'
            : 'Все известные значения равны нулю. Подробности и полнота оценки — в таблице.'}
        </p>
      ) : chart.kind === 'pyramid' ? (
        <ReportPyramid chart={chart} />
      ) : chart.kind === 'donut' ? (
        <ReportDonut chart={chart} />
      ) : chart.kind === 'stacked' ? (
        <ReportStacked chart={chart} />
      ) : chart.kind !== 'bars' ? (
        <ReportTimeline chart={chart} format={format} />
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
            <div className="report-chart-group" key={row.id}>
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
                          value: row.values[i],
                          label: format(row.values[i]),
                        },
                      ],
                )}
              />
            </div>
          ))}
        </div>
      )}
      {!allZero && chart.kind === 'bars' && chart.rows.length > 12 && (
        <Button variant="ghost" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Свернуть до 12 групп' : `Показать все группы · ${chart.rows.length}`}
        </Button>
      )}
      {chart.note && <p className="ws-muted">{chart.note}</p>}
    </section>
  );
}

function ReportTimeline({
  chart,
  format,
}: {
  chart: StatisticsChart;
  format: (v: number | null) => string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [available, setAvailable] = useState(360);
  useEffect(() => {
    const measure = () => setAvailable(container.current?.clientWidth || 360);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container.current!);
    return () => observer.disconnect();
  }, []);
  const rawMaximum = Math.max(
    1,
    chart.reference?.value || 0,
    ...chart.rows.flatMap((r) => r.values.map((v) => v || 0)),
  );
  const scale = chartScale(rawMaximum, chart.maximum);
  const maximum = scale.maximum;
  const left = Math.max(56, Math.min(180, format(maximum).length * 9 + 16));
  const width = Math.max(
    available,
    280,
    chart.rows.length * (chart.kind === 'lines' ? 32 : 72) + left + 16,
  );
  const height = available <= 600 ? 320 : 380;
  const top = 32;
  const bottom = height - 52;
  const plotHeight = bottom - top;
  const yAt = (value: number) => bottom - (value / maximum) * plotHeight;
  const xAt = (index: number) => left + ((index + 0.5) * (width - left - 16)) / chart.rows.length;
  const columnWidth = Math.min(56, Math.max(24, ((width - left - 16) / chart.rows.length) * 0.56));
  const compact = (v: number | null) =>
    v === null
      ? '—'
      : chart.format === 'money'
        ? (v / 100).toLocaleString('ru-RU', { notation: 'compact', maximumFractionDigits: 1 })
        : format(v);
  return (
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
                  className={`report-chart-line report-chart-series-${s.tone ?? i % 4}`}
                />
              </svg>
              {s.label}
            </span>
          ))}
        </div>
      )}
      <div
        ref={container}
        className="report-chart-scroll"
        tabIndex={0}
        role="region"
        aria-label={`${chart.title}: временная диаграмма`}
      >
        <svg
          className="report-columns"
          role="img"
          aria-label={chart.title}
          viewBox={`0 0 ${width} ${height}`}
          style={{ minWidth: width, height }}
        >
          <title>{chart.title}</title>
          <desc>
            {chart.rows
              .map(
                (r) =>
                  `${r.name}: ${r.values.map((v, i) => `${chart.series[i].label} ${format(v)}`).join(', ')}`,
              )
              .join('; ')}
          </desc>
          {scale.ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={left}
                x2={width - 16}
                y1={yAt(tick)}
                y2={yAt(tick)}
                className="report-chart-axis"
              />
              <text x={left - 8} y={yAt(tick) + 5} textAnchor="end">
                {format(tick)}
              </text>
            </g>
          ))}
          {chart.kind === 'lines' &&
            chart.series.flatMap((s, i) => {
              const segments: string[][] = [[]];
              chart.rows.forEach((r, j) => {
                const v = r.values[i];
                if (v === null) {
                  if (segments.at(-1)!.length) segments.push([]);
                } else segments.at(-1)!.push(`${xAt(j)},${yAt(v)}`);
              });
              return segments
                .filter((p) => p.length)
                .map((points, j) => (
                  <polyline
                    key={`${s.key}:${j}`}
                    points={points.join(' ')}
                    className={`report-chart-line report-chart-series-${s.tone ?? i % 4}`}
                  />
                ));
            })}
          {chart.reference && (
            <line
              x1={left}
              x2={width - 16}
              y1={yAt(chart.reference.value)}
              y2={yAt(chart.reference.value)}
              className="report-chart-mean"
            />
          )}
          {chart.rows.map((row, i) => (
            <g key={row.id}>
              {chart.kind === 'columns'
                ? row.values[0] !== null && (
                    <rect
                      x={xAt(i) - columnWidth / 2}
                      y={yAt(row.values[0])}
                      width={columnWidth}
                      height={(row.values[0] / maximum) * plotHeight}
                      rx="3"
                      className="report-chart-column"
                    >
                      <title>
                        {row.name}: {format(row.values[0])}
                      </title>
                    </rect>
                  )
                : row.values.map((v, j) =>
                    v === null ? null : (
                      <circle
                        key={chart.series[j].key}
                        cx={xAt(i)}
                        cy={yAt(v)}
                        r="4"
                        className={`report-chart-point report-chart-series-${chart.series[j].tone ?? j % 4}`}
                      >
                        <title>
                          {row.name} · {chart.series[j].label}: {format(v)}
                        </title>
                      </circle>
                    ),
                  )}
              {chart.kind === 'columns' && (
                <text x={xAt(i)} y={Math.max(20, yAt(row.values[0] || 0) - 12)} textAnchor="middle">
                  {compact(row.values[0])}
                </text>
              )}
              <text x={xAt(i)} y={height - 16} textAnchor="middle" data-chart-category="true">
                {chartCategory(row.name, row.id, chart.kind, chart.rows.length > 12)}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </>
  );
}

function ReportStacked({ chart }: { chart: StatisticsChart }) {
  return (
    <div className="report-stacked">
      <div className="report-chart-legend">
        {chart.series.map((s) => (
          <span key={s.key}>
            <i className={`report-donut-key report-donut-tone-${chartTone(s.key)}`} />
            {s.label}
          </span>
        ))}
      </div>
      {chart.rows.map((row) => {
        const total = row.values.reduce<number>((n, v) => n + (v || 0), 0);
        return (
          <div className="report-stacked-row" key={row.id}>
            <strong>{row.name}</strong>
            <span>
              Когорта: {total.toLocaleString('ru-RU')}
              {row.note ? ` · ${row.note}` : ''}
            </span>
            <div
              className="report-stacked-track"
              role="img"
              aria-label={chart.series
                .map((s, i) => `${s.label}: ${row.values[i] || 0}`)
                .join('; ')}
            >
              {chart.series.map(
                (s, i) =>
                  (row.values[i] || 0) > 0 && (
                    <span
                      aria-hidden="true"
                      key={s.key}
                      className={`report-donut-tone-${chartTone(s.key)}`}
                      style={{ flex: row.values[i]! }}
                    />
                  ),
              )}
            </div>
            <div className="report-stacked-values">
              {chart.series.map((s, i) => (
                <span key={s.key}>
                  {s.label}: <strong>{row.values[i] || 0}</strong>
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
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
        {rows.map((row) => {
          const length = (row.values[0]! / total) * circumference;
          const offset = -position;
          position += length;
          return (
            <circle
              key={row.id}
              cx="110"
              cy="110"
              r="76"
              className={`report-donut-segment report-donut-tone-${chartTone(row.id)}`}
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
        {rows.map((row) => (
          <li key={row.id}>
            <span
              className={`report-donut-key report-donut-tone-${chartTone(row.id)}`}
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
  const value = (n: number | null | undefined) =>
    n == null
      ? '—'
      : (chart.format === 'money' ? n / 100 : n).toLocaleString('ru-RU', {
          maximumFractionDigits: 2,
        });
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
              <span>{value(row.values[0])}</span>
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
              <span>{value(row.values[1])}</span>
            </div>
          </div>
        ))}
        <p className="ws-muted">
          Общая шкала: 0–{value(maximum)} · {chart.unit.toLowerCase()}
        </p>
      </div>
    </div>
  );
}
