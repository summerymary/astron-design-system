import type { ReportBlock, ReportFilters, ReportResult } from './statistics';

export type StatisticsChart = {
  id: string;
  title: string;
  unit: string;
  format?: 'money' | 'percent';
  kind: 'bars' | 'columns' | 'lines' | 'donut' | 'pyramid';
  series: { key: string; label: string }[];
  rows: { id: string; name: string; values: (number | null)[] }[];
  maximum?: number;
  reference?: { value: number; label: string };
  note?: string;
};

/** Explicit report contracts: never guess a metric from the first numeric column. */
export function statisticsCharts(
  id: string,
  result: ReportResult,
  f: ReportFilters,
): StatisticsChart[] {
  if (result.error || result.pending) return [];
  const charts: StatisticsChart[] = [];
  const add = (
    title: string,
    blockTitle: string,
    keys: string[],
    options: Partial<StatisticsChart> = {},
  ) => {
    const block = result.blocks.find((b) => b.title === blockTitle);
    if (!block || !keys.every((key) => block.columns.some((c) => c.key === key))) return;
    const columns = keys.map((key) => block.columns.find((c) => c.key === key)!);
    const rows = block.rows.map((r) => ({
      id: r.id,
      name: r.month ? `${r.month} · ${r.name}` : r.name,
      values: keys.map((key) =>
        r[key] !== '' && r[key] !== undefined && Number.isFinite(Number(r[key]))
          ? Number(r[key])
          : null,
      ),
    }));
    if (!rows.some((r) => r.values.some((v) => v !== null))) return;
    charts.push({
      id: `${id}:${charts.length}`,
      title,
      unit: columns.length === 1 ? columns[0].label : 'Количество',
      format:
        columns[0].format === 'money'
          ? 'money'
          : columns[0].format === 'percent'
            ? 'percent'
            : undefined,
      kind: 'bars',
      series: columns.map((c) => ({ key: c.key, label: c.label })),
      rows,
      ...options,
    });
  };
  if (id === 'unique_visits')
    add('Сколько клубов посещает один клиент', 'Клиенты по числу клубов', ['count'], {
      kind: 'donut',
      note: 'Каждый клиент входит ровно в одну группу. Это число клубов у клиента, а не рейтинг клубов.',
    });
  if (['clients_rating', 'clients_rating_visit'].includes(id))
    add(id === 'clients_rating' ? 'Рейтинг по сумме покупок' : 'Рейтинг по посещениям', 'Рейтинг', [
      'value',
    ]);
  if (id === 'notcame') add('Рейтинг по пропускам', 'Клиенты с пропусками', ['count']);
  if (id === 'timetoabstat') {
    for (const title of [
      'По клубам',
      'По направлению',
      'По полу',
      'По возрасту',
      'Популярность групповых программ',
      'По типам абонементов',
      'По названиям абонементов',
    ])
      add(
        title,
        title === 'Популярность групповых программ' ? 'Направления групповых программ' : title,
        [['По полу', 'По возрасту'].includes(title) ? 'clients' : 'count'],
      );
  }
  if (id === 'clients_gender_age')
    add('Пол и возраст посетителей', 'По полу и возрасту', ['male', 'female'], {
      kind: 'pyramid',
      note: 'Одинаковая шкала слева и справа. Неизвестные пол и возраст сохранены в таблице. Нажмите число в таблице, чтобы открыть клиентов.',
      unit: f.uniqueOnly === '1' ? 'Уникальных клиентов' : 'Посещений',
    });
  if (id === 'clients_sell_gender_age') {
    add(
      'Сумма покупок по полу и возрасту',
      'Сумма покупок по полу и возрасту',
      ['male', 'female', 'unknown'],
      { unit: '₽' },
    );
    add(
      'Средний чек по полу и возрасту',
      'Средний чек по полу и возрасту',
      ['male', 'female', 'unknown'],
      { unit: '₽', note: 'Нет покупок — средний чек неизвестен, а не равен нулю.' },
    );
  }
  if (id === 'newclients_source')
    add('Источники новых клиентов', 'Источники регистраций', ['count']);
  if (id === 'ptrener_rating') add('Количество персональных занятий', 'Тренеры', ['count']);
  if (id === 'ptrener_rating_all')
    add('Рабочие часы по видам нагрузки', 'Тренеры', ['personalHours', 'groupHours', 'dutyHours'], {
      unit: 'Часов',
      note: 'Общая шкала для ПТ, групповых занятий и дежурств.',
    });
  if (id === 'gtrener_rating')
    add('Заполняемость групповых занятий', 'Тренеры', ['occupancy'], {
      maximum: 100,
      note: '100% — заняты все места. Процент считается по записанным местам и вместимости.',
    });
  if (id === 'finbyyear_by_abonements' || id === 'selling_stat') {
    add('Сумма продаж', 'Распределение продаж', ['amount']);
    add('Количество продаж', 'Распределение продаж', ['count']);
  }
  if (id === 'finbyyear') {
    add('Выручка по месяцам', 'Распределение продаж', ['amount'], { kind: 'columns', unit: '₽' });
    const chart = charts[0];
    if (chart) {
      chart.rows.sort((a, b) => a.id.localeCompare(b.id));
      chart.reference = {
        value: chart.rows.reduce((sum, r) => sum + (r.values[0] ?? 0), 0) / chart.rows.length,
        label: 'Среднее за месяц',
      };
      chart.note =
        'Среднее — сумма сохранённых продаж / число месяцев выбранного периода, включая месяцы без сохранённых продаж. Неполные месяцы не пересчитываются до полных.';
    }
  }
  if (id === 'visit_by_period') {
    const block = result.blocks.find((b) => b.title === 'Посещения по дням и клубам');
    if (block?.rows.some((row) => row.total !== '')) charts.push(visitTimeline(block));
  }
  if (
    [
      'selling_clients_secondary',
      'selling_clients_secondary_summer',
      'selling_clients_afterguest',
    ].includes(id)
  ) {
    const rows = result.blocks[0]?.rows || [];
    // Summer cohorts remain separate by year, like the source. Open windows are never losses.
    const groups =
      id === 'selling_clients_secondary_summer'
        ? [...new Set(rows.map((r) => r.anchor.slice(0, 4)))].sort()
        : [''];
    for (const year of groups) {
      const list = rows.filter((r) => !year || r.anchor.startsWith(year));
      if (!list.length) continue;
      charts.push({
        id: `${id}:${year}`,
        title: `${id === 'selling_clients_afterguest' ? 'Покупка после гостевого визита' : 'Результат продления'}${year ? ` · ${year}` : ''}`,
        unit: 'Клиентов',
        kind: 'bars',
        series: [{ key: 'count', label: 'Клиентов' }],
        rows: ['Продлил', 'Не продлил', 'Окно ещё открыто'].map((status) => ({
          id: status,
          name:
            id === 'selling_clients_afterguest'
              ? {
                  Продлил: 'Купил абонемент',
                  'Не продлил': 'Не купил абонемент',
                  'Окно ещё открыто': 'Окно ещё открыто',
                }[status]!
              : status,
          values: [list.filter((r) => r.status === status).length],
        })),
        note: 'Незавершённые окна показаны отдельно. Процент конверсии выше рассчитан только по завершённым окнам.',
      });
    }
  }
  if (id === 'clients_segmetation') add('Сегменты базы', 'Сегменты базы', ['count']);
  if (id === 'unlim_avg_visit') add('Частота визитов по безлимитам', 'Частота визитов', ['count']);
  return charts;
}

function visitTimeline(block: ReportBlock): StatisticsChart {
  const clubColumns = block.columns.filter((column) => column.key.startsWith('club'));
  const rows = block.rows
    .filter((row) => row.total !== '')
    .map((row) => ({
      id: row.day,
      name: row.day.split('-').reverse().join('.'),
      values: ['total', ...clubColumns.map((column) => column.key)].map((key) =>
        row[key] === '' ? null : Number(row[key]),
      ),
    }));
  return {
    id: 'visit_by_period:daily',
    title: 'Посещения по дням и клубам',
    unit: 'Посещений',
    kind: 'lines',
    series: [
      { key: 'total', label: 'Всего' },
      ...clubColumns.map((column) => ({ key: column.key, label: column.label })),
    ],
    rows,
    note: 'Дневной шаг, итог и отдельная линия каждого клуба сохранены. Точные значения доступны в таблице ниже; ноль — отсутствие сохранённых демовизитов. График заканчивается текущим днём демочасов. Будущие даты остаются в таблице с —, а не с нулями.',
  };
}
