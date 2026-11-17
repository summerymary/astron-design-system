import type { DemoRecord } from '../data/workspace';
import { getClientProfile } from '../data/clientProfile';
import { clientName, hiddenPhone } from './client-display';
import { reportNextDay, reportWeek } from './report-period';
import type { ReportColumn, ReportFilters, ReportResult, StatisticsInput } from './statistics';

const handled = new Set([
  'gtrener_busy',
  'gtrener_rating',
  'ptrener_rating',
  'ptrener_rating_all',
  'report_pclients',
  'report_pclients_lost',
  'report_pclients_stat',
  'report_pclients_phones',
  'free_trener_find',
]);
const ids = (value = '') => [...new Set(value.split(',').filter(Boolean))];
const minutes = (value = '') => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
const hours = (rows: DemoRecord[]) =>
  (rows.reduce((n, e) => n + Number(e.duration || 0), 0) / 60).toFixed(1);
const column = (key: string, label: string, format?: ReportColumn['format']) => ({
  key,
  label,
  format,
});
const group = (rows: DemoRecord[], key: (row: DemoRecord) => string) => {
  const groups = new Map<string, DemoRecord[]>();
  for (const row of rows) groups.set(key(row), [...(groups.get(key(row)) || []), row]);
  return [...groups];
};

/** Distinct source report contracts, calculated only from known demo records. */
export function trainerStatistics(
  id: string,
  f: ReportFilters,
  input: StatisticsInput,
): ReportResult | null {
  if (!handled.has(id)) return null;
  const out: ReportResult = { metrics: [], blocks: [], notes: [] };
  const { data } = input;
  const now = /(?:Z|[+-]\d\d:\d\d)$/.test(input.at)
    ? new Date(Date.parse(input.at) + 10800000).toISOString().slice(0, 16)
    : input.at.slice(0, 16);
  const profiles = data['trainer-profiles'] || [];
  const trainerKey = (e: DemoRecord) => {
    if (e.trainerId) return e.trainerId;
    const matches = profiles.filter((t) => t.name === e.trainer);
    return matches.length === 1 ? matches[0].id : `unknown:${e.id}`;
  };
  const trainerName = (key: string, rows: DemoRecord[] = []) =>
    profiles.find((t) => t.id === key)?.name || rows[0]?.trainer || 'Тренер не определён';
  const inClub = (club: string) => f.club === 'all' || club === f.club;
  const inPeriod = (day: string) => day >= f.from && day <= f.to;
  const inTrainer = (row: DemoRecord) => f.trainer === 'all' || trainerKey(row) === f.trainer;
  const events = [...new Map((data.events || []).map((e) => [e.id, e])).values()].filter(
    (e) => !['Отменено', 'Отменена', 'Удалено'].includes(e.status),
  );
  const selected = events.filter((e) => inPeriod(e.day) && inClub(e.club) && inTrainer(e));
  const duties = [...new Map((data['trainer-duty'] || []).map((e) => [e.id, e])).values()].filter(
    (e) => !['Отменено', 'Отменена', 'Удалено'].includes(e.status),
  );
  const members = new Map(input.members.filter((m) => !m.archived).map((m) => [String(m.id), m]));
  const person = (memberId: string): DemoRecord => {
    const m = members.get(memberId)!;
    return {
      id: memberId,
      memberId,
      name: clientName(m),
      card: getClientProfile(m, data).card,
      phone: input.hidePhones ? hiddenPhone(m.phone) : m.phone,
    };
  };
  const add = (title: string, columns: ReportColumn[], rows: DemoRecord[], memberLinks = false) =>
    out.blocks.push({ title, columns, rows, memberLinks });
  const clientColumns = [column('name', 'Клиент'), column('card', 'Карта')];
  const commonNote =
    'Отменённые занятия исключены. Запись не равна посещению: присутствие учитывается только по отметке. Числа рассчитаны по демонстрационной истории, а не по данным источника.';

  if (id === 'gtrener_busy') {
    const week = reportWeek(f.to)!;
    const days = Array.from({ length: 7 }, (_, i) => reportNextDay(week.from, i));
    const list = events.filter(
      (e) => e.day >= week.from && e.day <= week.to && inClub(e.club) && inTrainer(e),
    );
    const rows = group(list, (e) => e.time)
      .map(([time, entries]) => ({
        id: time,
        name: time,
        ...Object.fromEntries(
          days.map((day, i) => [
            `day${i}`,
            entries
              .filter((e) => e.day === day)
              .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ru'))
              .map(
                (e) =>
                  `${e.name || 'Без названия'}\n${trainerName(trainerKey(e), [e])} · ${e.club}${e.room ? ` · ${e.room}` : ''}`,
              )
              .join('\n\n'),
          ]),
        ),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    add(
      `Неделя ${week.from.split('-').reverse().join('.')} — ${week.to.split('-').reverse().join('.')}`,
      [
        column('name', 'Начало'),
        ...days.map((day, i) =>
          column(
            `day${i}`,
            `${['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'][i]} ${day.slice(8)}.${day.slice(5, 7)}`,
          ),
        ),
      ],
      rows,
    );
    out.metrics = [
      { label: 'Занятий за неделю', value: list.length },
      { label: 'Тренеров с занятиями', value: new Set(list.map(trainerKey)).size },
    ];
    out.notes.push(
      'Полная неделя Пн–Вс: строки — точное начало, столбцы — дни. В ячейке название, тренер, клуб и зал. Показаны все виды занятий из деморасписания, включая персональные; отдельной модели бронирования уборки пока нет. Пустая ячейка не подтверждает свободное рабочее время.',
      commonNote,
    );
  } else if (['gtrener_rating', 'ptrener_rating', 'ptrener_rating_all'].includes(id)) {
    const list = selected.filter((e) =>
      id === 'ptrener_rating'
        ? e.kind === 'personal'
        : id === 'gtrener_rating'
          ? e.kind !== 'personal'
          : e.kind === 'personal'
            ? f.countPersonal === '1'
            : f.countGroup === '1',
    );
    const load = [
      ...list,
      ...(id === 'ptrener_rating_all' && f.countDuty === '1'
        ? duties
            .filter((d) => inPeriod(d.day) && inClub(d.club) && inTrainer(d))
            .map((d) => ({ ...d, kind: 'duty' }))
        : []),
    ];
    const rows = group(load, trainerKey)
      .map(([key, entries]): DemoRecord => {
        const classes = entries.filter((e) => e.kind !== 'duty');
        const capacity = classes.reduce((n, e) => n + Number(e.capacity || 0), 0);
        const booked = classes.reduce((n, e) => n + Number(e.booked || 0), 0);
        // PT/SPT is an explicit classification, never inferred from group size or price.
        const personal = classes.filter((e) => e.kind === 'personal');
        const classified = personal.every((e) => ['individual', 'spt'].includes(e.personalFormat));
        const online = (e: DemoRecord) => e.kind === 'online' || e.format === 'Онлайн';
        return {
          id: key,
          name: trainerName(key, entries),
          count: String(classes.length),
          hours: hours(entries),
          personalHours: hours(entries.filter((e) => e.kind === 'personal')),
          groupHours: hours(entries.filter((e) => !['personal', 'duty'].includes(e.kind))),
          dutyHours: hours(entries.filter((e) => e.kind === 'duty')),
          individualHours: classified
            ? hours(personal.filter((e) => e.personalFormat === 'individual'))
            : '',
          sptHours: classified ? hours(personal.filter((e) => e.personalFormat === 'spt')) : '',
          individual: classified
            ? String(personal.filter((e) => e.personalFormat === 'individual').length)
            : '',
          spt: classified ? String(personal.filter((e) => e.personalFormat === 'spt').length) : '',
          sptClients: classified
            ? String(
                personal
                  .filter((e) => e.personalFormat === 'spt')
                  .reduce((n, e) => n + ids(e.attendees).length, 0),
              )
            : '',
          unique: String(new Set(classes.flatMap((e) => ids(e.attendees))).size),
          offline: String(classes.filter((e) => !online(e)).length),
          online: String(classes.filter(online).length),
          programs: String(
            new Set(
              classes
                .map((e) => e.templateId || (e.name || '').trim().toLocaleLowerCase('ru'))
                .filter(Boolean),
            ).size,
          ),
          present: String(classes.reduce((n, e) => n + ids(e.present).length, 0)),
          booked: String(booked),
          capacity: String(capacity),
          occupancy:
            capacity > 0 && classes.every((e) => Number(e.capacity) > 0)
              ? String(Math.round((booked * 100) / capacity))
              : '',
        };
      })
      .sort(
        (a, b) =>
          Number(
            b[
              id === 'gtrener_rating'
                ? 'occupancy'
                : id === 'ptrener_rating_all'
                  ? 'hours'
                  : 'count'
            ],
          ) -
            Number(
              a[
                id === 'gtrener_rating'
                  ? 'occupancy'
                  : id === 'ptrener_rating_all'
                    ? 'hours'
                    : 'count'
              ],
            ) || a.name.localeCompare(b.name, 'ru'),
      );
    const columns =
      id === 'gtrener_rating'
        ? [
            column('count', 'Занятий'),
            column('offline', 'В клубе'),
            column('online', 'Онлайн'),
            column('programs', 'Разных программ'),
            column('booked', 'Записей клиентов'),
            column('present', 'Отмечено посещений'),
            column('occupancy', 'Заполняемость по записям', 'percent'),
          ]
        : id === 'ptrener_rating'
          ? [
              column('count', 'Персональных занятий'),
              column('individual', 'Индивидуальных ПТ'),
              column('spt', 'СПТ'),
              column('sptClients', 'Записей в СПТ'),
              column('unique', 'Уникальных записанных'),
              column('present', 'Отмечено посещений'),
            ]
          : [
              column('personalHours', 'Часов ПТ всего'),
              column('individualHours', 'Из них ПТ, ч'),
              column('sptHours', 'Из них СПТ, ч'),
              column('groupHours', 'Часов ГП'),
              column('dutyHours', 'Дежурных часов'),
              column('hours', 'Всего часов'),
              column('count', 'Занятий'),
            ];
    add('Тренеры', [column('name', 'Тренер'), ...columns], rows);
    out.metrics = [
      { label: 'Тренеров в выборке', value: rows.length },
      { label: 'Занятий по расписанию', value: list.length },
    ];
    out.notes.push(commonNote);
    if (id === 'gtrener_rating')
      out.notes.push(
        'В клубе + онлайн = все групповые занятия. Разные программы считаются по шаблону занятия, при его отсутствии — по названию. Заполняемость — сумма записанных мест / сумма вместимости, а не среднее процентов; неизвестная вместимость не считается нулевой заполняемостью. Фактические посещения показаны отдельно.',
      );
    if (id === 'ptrener_rating')
      out.notes.push(
        'Структура ПТ / СПТ сохранена из источника. Значение СПТ и его сопоставление с моделью занятий требуют подтверждения: без явного personalFormat разбиение показано «—». Уникальные записанные считаются по известным ID участников, а не по числу мест.',
      );
    if (id === 'ptrener_rating_all')
      out.notes.push(
        'ПТ, групповые занятия и дежурства показаны отдельно и суммируются в «Всего часов». Флажки исключают соответствующий вид нагрузки из таблицы и диаграммы. Это часы по расписанию, не табель и не оплаченные часы; пересекающиеся записи могут дать двойной учёт времени. Разбиение ПТ / СПТ пока не подтверждено.',
      );
  } else if (id === 'free_trener_find') {
    const start = minutes(f.timeFrom),
      duration = Number(f.duration);
    if (duration < 1 || duration > 240 || start + duration > 1440)
      return { ...out, error: 'Укажите длительность 1–240 минут в пределах выбранного дня.' };
    const windows = (data['trainer-availability'] || []).filter(
      (s) =>
        s.day === f.to &&
        inClub(s.club) &&
        (f.trainer === 'all' || s.trainerId === f.trainer) &&
        minutes(s.time) <= start &&
        minutes(s.end) >= start + duration,
    );
    const seen = new Set<string>();
    const rows = windows
      .flatMap((s) => {
        const key = `${s.trainerId}|${s.club}`;
        const t = profiles.find((t) => t.id === s.trainerId && t.status !== 'В архиве');
        const busy = [...events, ...duties].some(
          (e) =>
            e.day === f.to &&
            trainerKey(e) === s.trainerId &&
            minutes(e.time) < start + duration &&
            start < minutes(e.time) + Number(e.duration || 0),
        );
        if (!t || busy || seen.has(key)) return [];
        seen.add(key);
        return [
          {
            id: key,
            name: t.name,
            club: s.club,
            date: s.day,
            time: f.timeFrom,
            duration: String(duration),
            category:
              (data['trainer-categories'] || []).find((c) => c.id === t.categoryId)?.name ||
              'Не указана',
          },
        ];
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    add(
      'Свободные тренеры в рабочее время',
      [
        column('name', 'Тренер'),
        column('category', 'Категория'),
        column('club', 'Клуб'),
        column('date', 'Дата', 'date'),
        column('time', 'Начало'),
        column('duration', 'Минут'),
      ],
      rows,
    );
    out.notes.push(
      'Проверяются явно заданное рабочее окно, занятия и дежурства во всех клубах. Соседние интервалы без пересечения допустимы. Повторные окна одного тренера в одном клубе объединены. Нет рабочего окна — доступность неизвестна. Время на дорогу между клубами в демомодели не задано. Это просмотр, он не создаёт запись.',
    );
  } else {
    const personal = events.filter((e) => e.kind === 'personal' && inClub(e.club) && inTrainer(e));
    // Keep historical relationships even after a client is reassigned to another coach.
    const pairs = new Map<string, { trainerId: string; memberId: string }>();
    for (const a of data['personal-clients'] || [])
      if (members.has(a.memberId) && (f.trainer === 'all' || a.trainerId === f.trainer))
        pairs.set(`${a.trainerId}|${a.memberId}`, {
          trainerId: a.trainerId,
          memberId: a.memberId,
        });
    for (const e of personal)
      for (const memberId of ids(e.attendees).concat(ids(e.present)))
        if (members.has(memberId))
          pairs.set(`${trainerKey(e)}|${memberId}`, { trainerId: trainerKey(e), memberId });
    const pairsRows = [...pairs].map(([key, a]): DemoRecord => {
      const entries = personal.filter(
        (e) =>
          trainerKey(e) === a.trainerId &&
          (ids(e.attendees).includes(a.memberId) || ids(e.present).includes(a.memberId)),
      );
      const attended = entries.filter(
        (e) =>
          ids(e.present).includes(a.memberId) &&
          `${e.day}T${e.time}` <= `${f.to}T23:59` &&
          `${e.day}T${e.time}` <= now,
      );
      const last =
        attended
          .map((e) => e.day)
          .sort()
          .at(-1) || '';
      return {
        ...person(a.memberId),
        id: key,
        trainerId: a.trainerId,
        trainer: trainerName(a.trainerId, entries),
        booked: String(entries.filter((e) => inPeriod(e.day)).length),
        present: String(attended.filter((e) => inPeriod(e.day)).length),
        last,
        status: !last
          ? 'Нет истории ПТ'
          : (Date.parse(f.to) - Date.parse(last)) / 86400000 > Number(f.threshold)
            ? 'Потерянный'
            : 'Активный',
      };
    });
    if (id === 'report_pclients_stat') {
      const known = pairsRows.filter((r) => r.last && r.last >= f.from);
      const lost = known.filter((r) => r.status === 'Потерянный').length;
      out.metrics = [
        {
          label:
            f.trainer === 'all' ? 'Связей клиент — тренер за период' : 'Клиентов тренера за период',
          value: known.length,
        },
        { label: 'Активных', value: known.length - lost },
        { label: 'Потерянных', value: lost },
        {
          label: 'Доля потерянных',
          value: known.length ? `${Math.round((lost * 100) / known.length)}%` : '—',
        },
      ];
      add(
        'Клиенты и состояние',
        [
          ...clientColumns,
          column('trainer', 'Тренер'),
          column('last', 'Последняя отметка у тренера', 'date'),
          column('status', 'Состояние'),
        ],
        known,
        true,
      );
      out.notes.push(
        'Демо-правило потери: больше выбранного числа дней без отметки у того же тренера. В выборке только пары клиент–тренер с подтверждённым посещением между началом периода и датой отчёта; показатели и таблица используют одну выборку. Визит к другому тренеру не улучшает удержание. При всех тренерах один клиент может относиться к нескольким тренерам.',
        `Связей без отметок в выбранном периоде: ${pairsRows.length - known.length}; в долю потерь не включены. Формула источника до конца не подтверждена — демонстрационный расчёт описан явно.`,
      );
    } else {
      let rows = pairsRows.filter((r) =>
        id === 'report_pclients_lost'
          ? r.last && r.last >= f.from && r.last < reportNextDay(f.to, -Number(f.threshold))
          : Number(r.booked) > 0,
      );
      if (id === 'report_pclients_phones')
        rows = group(rows, (r) => r.memberId).map(([memberId, entries]) => ({
          ...person(memberId),
          trainer: [...new Set(entries.map((r) => r.trainer))].join(', '),
          booked: String(entries.reduce((n, r) => n + Number(r.booked), 0)),
          present: String(entries.reduce((n, r) => n + Number(r.present), 0)),
          last:
            entries
              .map((r) => r.last)
              .sort()
              .at(-1) || '',
        }));
      rows.sort(
        (a, b) => a.name.localeCompare(b.name, 'ru') || a.trainer.localeCompare(b.trainer, 'ru'),
      );
      add(
        id === 'report_pclients_phones' ? 'Контакты персональных клиентов' : 'Персональные клиенты',
        [
          ...clientColumns,
          column('trainer', 'Тренер'),
          column('phone', 'Телефон'),
          ...(id === 'report_pclients_lost'
            ? []
            : [column('booked', 'Записей за период'), column('present', 'Отмечено посещений')]),
          column('last', 'Последняя отметка у тренера', 'date'),
        ],
        rows,
        true,
      );
      out.metrics = [
        {
          label: 'Уникальных клиентов в выборке',
          value: new Set(rows.map((r) => r.memberId)).size,
        },
      ];
      out.notes.push(
        'Учитываются записи к конкретному тренеру, включая исторические связи после смены закрепления. Повторные закрепления не дублируют клиента. В контактах каждый клиент показан один раз, со списком тренеров; телефоны и CSV соблюдают права роли.',
        'Демо-правило потери: последняя подтверждённая отметка у этого тренера в выбранном периоде, но раньше выбранного интервала бездействия. Без истории отметок клиент не считается потерянным.',
      );
    }
    out.notes.push(commonNote);
  }
  return out;
}
