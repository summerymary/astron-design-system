import type { DemoRecord } from '../data/workspace';
import { money } from '../data/workspace';
import type { Member, Visit } from '../types';
import { getClientProfile } from '../data/clientProfile';
import { clientName, hiddenPhone } from './client-display';
import { cashCents, cashFlow, cashJournal } from './cash';
import { reportPending } from '../data/statistics';
import { detailedStatistics } from './statistics-details';
import { trainerStatistics } from './statistics-trainers';
import { getMembershipKind } from '../data/membership-kinds';
import { nextBirthday, reportNextDay } from './report-period';

export type ReportFilters = {
  from: string;
  to: string;
  club: string;
  clubs: string;
  kind: string;
  trainer: string;
  gender: string;
  ageFrom: string;
  ageTo: string;
  timeFrom: string;
  timeTo: string;
  limit: string;
  threshold: string;
  criterion: string;
  channel: string;
  compare: string;
  grouping: string;
  includePersonal: string;
  includeSingle: string;
  includeCorporate: string;
  onlyUnlimited: string;
  uniqueOnly: string;
  onlyPersonal: string;
  source: string;
  onlyOnline: string;
  onlyNoPurchase: string;
  segment: string;
  operator: string;
  callStatus: string;
  onlyUnknown: string;
  plan: string;
  countPersonal: string;
  countGroup: string;
  countDuty: string;
  duration: string;
  renewalDays: string;
  groupByTrainer: string;
  reportSort: string;
};
export const defaultReportFilters: ReportFilters = {
  from: '2026-11-01',
  to: '2026-11-06',
  club: 'all',
  clubs: '',
  kind: 'all',
  trainer: 'all',
  gender: 'all',
  ageFrom: '',
  ageTo: '',
  timeFrom: '00:00',
  timeTo: '23:59',
  limit: '20',
  threshold: '21',
  criterion: 'registration',
  channel: 'all',
  compare: 'none',
  grouping: 'plan',
  includePersonal: '1',
  includeSingle: '1',
  includeCorporate: '1',
  onlyUnlimited: '0',
  uniqueOnly: '0',
  onlyPersonal: '0',
  source: 'all',
  onlyOnline: '0',
  onlyNoPurchase: '0',
  segment: 'all',
  operator: 'all',
  callStatus: 'all',
  onlyUnknown: '0',
  plan: 'all',
  countPersonal: '1',
  countGroup: '1',
  countDuty: '1',
  duration: '60',
  renewalDays: '30',
  groupByTrainer: '0',
  reportSort: 'avg_visitors',
};
export type ReportColumn = { key: string; label: string; format?: 'money' | 'date' | 'percent' };
export type ReportBlock = {
  title: string;
  columns: ReportColumn[];
  rows: DemoRecord[];
  memberLinks?: boolean;
};
export type ReportResult = {
  metrics: { label: string; value: string | number; note?: string }[];
  blocks: ReportBlock[];
  notes: string[];
  error?: string;
  pending?: string;
};
export type StatisticsInput = {
  members: Member[];
  visits: Visit[];
  data: Record<string, DemoRecord[]>;
  at: string;
  hidePhones?: boolean;
};
const dayMs = 86400000;
export const reportDay = (value: string) =>
  /^\d{2}\.\d{2}\.\d{4}$/.test(value) ? value.split('.').reverse().join('-') : value.slice(0, 10);
export function validReportDay(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !isNaN(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}
const shift = (day: string, n: number) =>
  new Date(Date.parse(day) + n * dayMs).toISOString().slice(0, 10);
export function previousReportPeriod(from: string, to: string) {
  if (!validReportDay(from) || !validReportDay(to) || from > to) return null;
  const days = Math.round((Date.parse(to) - Date.parse(from)) / dayMs) + 1;
  return { from: shift(from, -days), to: shift(from, -1) };
}
export function reportAge(birth: string, at: string): number | null {
  const day = reportDay(birth);
  if (!validReportDay(day) || day > at) return null;
  const age =
    Number(at.slice(0, 4)) - Number(day.slice(0, 4)) - (at.slice(5) < day.slice(5) ? 1 : 0);
  return age <= 120 ? age : null;
}
function reportAgeLabel(value: string) {
  const age = Number(value);
  const lastTwo = age % 100;
  const last = age % 10;
  const unit =
    lastTwo >= 11 && lastTwo <= 14
      ? 'лет'
      : last === 1
        ? 'год'
        : last >= 2 && last <= 4
          ? 'года'
          : 'лет';
  return `${value} ${unit}`;
}
export function reportFilterError(f: ReportFilters): string | null {
  if (!validReportDay(f.from) || !validReportDay(f.to) || f.from > f.to)
    return 'Укажите корректные даты: начало не позже конца периода.';
  if (
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(f.timeFrom) ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(f.timeTo) ||
    f.timeFrom > f.timeTo
  )
    return 'Начало времени не должно быть позже конца.';
  for (const key of [
    'ageFrom',
    'ageTo',
    'limit',
    'threshold',
    'duration',
    'renewalDays',
  ] as const) {
    if (
      f[key] !== '' &&
      (!/^\d+$/.test(f[key]) || Number(f[key]) > (key.startsWith('age') ? 120 : 10000))
    )
      return 'Используйте целые неотрицательные значения фильтров.';
  }
  if (f.ageFrom && f.ageTo && Number(f.ageFrom) > Number(f.ageTo))
    return 'Минимальный возраст не должен превышать максимальный.';
  if (!f.limit || Number(f.limit) < 1) return 'Размер списка должен быть не меньше одного.';
  return null;
}
const clubNames: Record<string, string> = { central: 'Центральный', park: 'Парк', river: 'Речной' };
const kindNames: Record<string, string> = {
  gym: 'Тренажёрный зал',
  group: 'Групповые занятия',
  personal: 'Персональные тренировки',
  online: 'Онлайн-тренировки',
};
const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);
const currency = (cents: number) => money(cents / 100);
const ids = (value = '') => value.split(',').filter(Boolean);
const countDistinct = <T>(rows: T[], key: (row: T) => string | number) =>
  new Set(rows.map(key)).size;
const col = (key: string, label: string, format?: ReportColumn['format']): ReportColumn => ({
  key,
  label,
  format,
});

/** All results derive from in-memory prototype records. Source pages are never queried. */
export function buildStatistics(
  id: string,
  f: ReportFilters,
  input: StatisticsInput,
): ReportResult {
  const result: ReportResult = { metrics: [], blocks: [], notes: [] };
  if (id === 'birdthday') {
    const today = reportDay(input.at);
    if (!validReportDay(today)) return { ...result, error: 'Не удалось определить текущую дату.' };
    f = { ...f, from: today, to: shift(today, 29) };
  }
  const error = reportFilterError(f);
  if (error) return { ...result, error };
  const trainerReport = trainerStatistics(id, f, input);
  if (trainerReport) return trainerReport;
  const detailed = detailedStatistics(id, f, input);
  if (detailed) return detailed;
  if (reportPending[id]) return { ...result, pending: reportPending[id] };
  const { data, visits, at } = input;
  const members = input.members.filter((m) => !m.archived);
  const inPeriod = (date: string) => date >= f.from && date <= f.to;
  const inClub = (club: string) =>
    id === 'clients_gender_age' && f.clubs
      ? f.clubs.split(',').includes(club)
      : f.club === 'all' || club === f.club;
  const profile = (m: Member) => getClientProfile(m, data);
  const memberById = new Map(members.map((m) => [String(m.id), m]));
  const person = (m: Member): DemoRecord => ({
    id: String(m.id),
    memberId: String(m.id),
    name: clientName(m),
    phone: input.hidePhones ? hiddenPhone(m.phone) : m.phone,
    card: profile(m).card,
  });
  const passes = members.flatMap((m) =>
    profile(m).subscriptions.map((p) => ({ ...p, memberId: String(m.id) })),
  );
  const matchedMember = (m: Member) => {
    const p = profile(m),
      age = reportAge(p.birthDate, f.to);
    return (
      (f.gender === 'all' || p.gender === f.gender) &&
      (!f.ageFrom || (age !== null && age >= Number(f.ageFrom))) &&
      (!f.ageTo || (age !== null && age <= Number(f.ageTo)))
    );
  };
  // UTC timestamps and local demo timestamps use the same Moscow day/time convention.
  const localTimestamp = (value: string) =>
    /(?:Z|[+-]\d\d:\d\d)$/.test(value)
      ? new Date(new Date(value).getTime() + 3 * 3600000).toISOString().slice(0, 16)
      : value;
  const allVisits = [...new Map(visits.map((v) => [v.id, v])).values()].map((v) => ({
    ...v,
    local: localTimestamp(v.enteredAt),
    club: clubNames[v.clubId] || v.clubId,
  }));
  const scopedVisits = allVisits.filter(
    (v) => inClub(v.club) && (f.kind === 'all' || v.kind === f.kind),
  );
  const filteredVisits = scopedVisits.filter(
    (v) =>
      inPeriod(v.local.slice(0, 10)) &&
      v.local.slice(11, 16) >= f.timeFrom &&
      v.local.slice(11, 16) <= f.timeTo &&
      (memberById.has(String(v.memberId))
        ? matchedMember(memberById.get(String(v.memberId))!)
        : f.gender === 'all' && !f.ageFrom && !f.ageTo),
  );
  const trainerKey = (event: DemoRecord) => {
    if (event.trainerId) return event.trainerId;
    const matches = (data['trainer-profiles'] || []).filter((t) => t.name === event.trainer);
    return matches.length === 1 ? matches[0].id : `unknown:${event.id}`;
  };
  const events = (data.events || []).filter(
    (e) =>
      e.status !== 'Отменено' &&
      inClub(e.club) &&
      (f.trainer === 'all' || trainerKey(e) === f.trainer),
  );
  const selectedEvents = events.filter((e) => inPeriod(e.day));
  const pastEvents = selectedEvents.filter((e) => `${e.day}T${e.time}` < at);
  const ledger = (data.ledger || []).filter(
    (r) => r.category !== 'Бар' && !['Отменено', 'Отменена'].includes(r.status),
  );
  const cashMovements = (data['cash-events'] || []).filter((r) => r.category !== 'Бар');
  const sales = ledger.filter(
    (r) =>
      (!r.kind || r.kind === 'sale') &&
      inPeriod(r.date) &&
      inClub(r.club) &&
      (f.channel === 'all' || (f.channel === 'online' ? r.method === 'Сайт' : r.method !== 'Сайт')),
  );
  const resolveBuyer = (sale: DemoRecord) => {
    if (sale.memberId) return memberById.get(sale.memberId);
    const matches = members.filter((m) => [m.name, clientName(m)].includes(sale.client));
    return matches.length === 1 ? matches[0] : undefined;
  };
  const lastVisit = (memberId: number, personal = false) =>
    scopedVisits
      .filter(
        (v) =>
          v.memberId === memberId &&
          v.local.slice(0, 10) <= f.to &&
          (!personal || v.kind === 'personal'),
      )
      .map((v) => v.local.slice(0, 10))
      .sort()
      .at(-1) || '';
  const block = (title: string, columns: ReportColumn[], rows: DemoRecord[], memberLinks = false) =>
    result.blocks.push({ title, columns, rows, memberLinks });
  const grouped = <T>(rows: T[], key: (r: T) => string) => {
    const groups = new Map<string, T[]>();
    for (const row of rows) {
      const k = key(row);
      groups.set(k, [...(groups.get(k) || []), row]);
    }
    return [...groups];
  };
  const totalSales = sales.reduce((sum, s) => sum + cashCents(s.amount), 0);
  const names = [col('name', 'Клиент'), col('card', 'Карта')];

  if (id === 'unique_visits') {
    result.metrics = [
      {
        label: 'Уникальных по сети',
        value: countDistinct(filteredVisits, (v) => v.memberId),
        note: 'Клиент учитывается один раз во всех клубах',
      },
      { label: 'Посещений', value: filteredVisits.length },
      {
        label: 'Новых посетителей',
        value: countDistinct(
          filteredVisits.filter((v) => {
            const m = memberById.get(String(v.memberId));
            return Boolean(m && inPeriod(reportDay(m.joined)));
          }),
          (v) => v.memberId,
        ),
      },
    ];
    const periodDays = Math.round((Date.parse(f.to) - Date.parse(f.from)) / dayMs) + 1;
    const clubs =
      f.club === 'all'
        ? [...new Set([...Object.values(clubNames), ...filteredVisits.map((v) => v.club)])]
        : [f.club];
    const uniqueCount = (rows: typeof filteredVisits) => countDistinct(rows, (v) => v.memberId);
    const ratio = (n: number, d: number) => (d ? (n / d).toFixed(2) : '');
    for (const [title, list] of [
      ['Все направления', filteredVisits],
      ['Персональные посещения', filteredVisits.filter((v) => v.kind === 'personal')],
      ['Другие направления', filteredVisits.filter((v) => v.kind !== 'personal')],
    ] as const) {
      const summarize = (
        name: string,
        rows: typeof filteredVisits,
        all: typeof filteredVisits,
        total = false,
      ): DemoRecord => ({
        id: total ? 'network-total' : name,
        name,
        clients: String(uniqueCount(rows)),
        new: String(
          uniqueCount(
            rows.filter((v) => {
              const m = memberById.get(String(v.memberId));
              return Boolean(m && inPeriod(reportDay(m.joined)));
            }),
          ),
        ),
        share: ratio(uniqueCount(rows) * 100, uniqueCount(all)),
        visits: String(rows.length),
        average: ratio(rows.length, uniqueCount(rows)),
        perDay: ratio(rows.length, periodDays),
        dailyUnique: String(countDistinct(rows, (v) => `${v.local.slice(0, 10)}|${v.memberId}`)),
      });
      block(
        title,
        [
          col('name', 'Клуб'),
          col('clients', 'Уникальных клиентов'),
          col('new', 'Из них новых'),
          ...(title !== 'Все направления'
            ? [col('share', 'Доля посетителей клуба', 'percent')]
            : []),
          col('visits', 'Посещений'),
          col('average', 'Визитов на клиента'),
          col('perDay', 'Визитов в день'),
          col('dailyUnique', 'Сумма уникальных по дням'),
        ],
        [
          ...clubs.map((club) =>
            summarize(
              club,
              list.filter((v) => v.club === club),
              filteredVisits.filter((v) => v.club === club),
            ),
          ),
          summarize(
            f.club === 'all' ? 'Вся сеть · без повторов' : 'Итого по клубу',
            [...list],
            filteredVisits,
            true,
          ),
        ],
      );
    }
    result.notes.push(
      'Уникальный клиент учитывается один раз за период. В итоге сети он не повторяется между клубами; итог нельзя получить сложением клубных строк. Новые — посетители, зарегистрированные в выбранном периоде.',
      'Визитов на клиента = посещения / уникальные клиенты. Визитов в день = посещения / календарные дни периода. Сумма уникальных по дням считает человека один раз в каждом дне; в итоге сети также убирает повторы между клубами за день. При отсутствии клиентов среднее и доля не определены (—).',
      'В персональной и неперсональной сводке доля — от всех посетителей того же клуба или сети. Один человек мог посещать оба направления: эти доли не складываются в 100%.',
    );
    const clubCounts = grouped(filteredVisits, (v) => String(v.memberId)).map(
      ([, visits]) => new Set(visits.map((v) => v.club)).size,
    );
    block(
      'Клиенты по числу клубов',
      [
        col('name', 'Посещено клубов'),
        col('count', 'Клиентов'),
        col('share', 'Доля клиентов', 'percent'),
      ],
      [...new Set(clubCounts)]
        .sort((a, b) => a - b)
        .map((count) => ({
          id: String(count),
          name: `${count} ${count === 1 ? 'клуб' : count < 5 ? 'клуба' : 'клубов'}`,
          count: String(clubCounts.filter((n) => n === count).length),
          share: ((clubCounts.filter((n) => n === count).length * 100) / clubCounts.length).toFixed(
            1,
          ),
        })),
    );
  } else if (['clients_rating', 'clients_rating_visit'].includes(id)) {
    const byMoney = id === 'clients_rating';
    const rows = members
      .map((m) => ({
        ...person(m),
        value: String(
          byMoney
            ? sales
                .filter((s) => resolveBuyer(s)?.id === m.id)
                .reduce((n, s) => n + cashCents(s.amount), 0)
            : filteredVisits.filter((v) => v.memberId === m.id).length,
        ),
      }))
      .filter((r) => Number(r.value) > 0)
      .sort((a, b) => Number(b.value) - Number(a.value))
      .slice(0, Number(f.limit));
    block(
      'Рейтинг',
      [
        ...names,
        col('value', byMoney ? 'Сумма покупок' : 'Посещений', byMoney ? 'money' : undefined),
      ],
      rows,
      true,
    );
    if (byMoney)
      result.notes.push(
        'Покупки учитываются по итоговой сумме продажи; это не прибыль и не поступления в кассу. Неопознанные покупатели не приписываются клиенту.',
      );
  } else if (id === 'notcame') {
    const counts = new Map<string, number>();
    for (const e of pastEvents.filter(
      (e) => Date.parse(`${e.day}T${e.time}`) + Number(e.duration || 0) * 60000 < Date.parse(at),
    )) {
      for (const mid of [...new Set(ids(e.attendees))].filter(
        (mid) => !ids(e.present).includes(mid),
      ))
        counts.set(mid, (counts.get(mid) || 0) + 1);
    }
    block(
      'Клиенты с пропусками',
      [...names, col('phone', 'Телефон'), col('count', 'Пропусков')],
      members
        .filter((m) => (counts.get(String(m.id)) || 0) >= Math.max(1, Number(f.threshold)))
        .map((m): DemoRecord => ({ ...person(m), count: String(counts.get(String(m.id))) }))
        .sort((a, b) => Number(b.count) - Number(a.count) || a.name.localeCompare(b.name, 'ru'))
        .slice(0, Number(f.limit)),
      true,
    );
    result.notes.push(
      'В деморасчёте пропуск — запись без отметки присутствия после окончания занятия. Отменённые занятия и резерв исключены. Показаны клиенты с количеством пропусков не меньше выбранного минимума, по убыванию. Отсутствие отметки в неполной демоистории не доказывает реальный пропуск.',
    );
  } else if (id === 'birdthday') {
    const today = reportDay(at);
    block(
      'Дни рождения в ближайшие 30 дней',
      [
        col('birthday', 'День рождения', 'date'),
        ...names,
        col('age', 'Исполняется лет'),
        col('days', 'Через дней'),
        col('phone', 'Телефон'),
        col('last', 'Последний визит', 'date'),
      ],
      members
        .flatMap((m): DemoRecord[] => {
          const birth = reportDay(profile(m).birthDate);
          const birthday = nextBirthday(birth, today);
          if (!birthday || birthday > f.to) return [];
          return [
            {
              ...person(m),
              birthday,
              age: String(Number(birthday.slice(0, 4)) - Number(birth.slice(0, 4))),
              days: String(Math.round((Date.parse(birthday) - Date.parse(today)) / dayMs)),
              last:
                allVisits
                  .filter((v) => v.memberId === m.id && v.local.slice(0, 10) <= today)
                  .map((v) => v.local.slice(0, 10))
                  .sort()
                  .at(-1) || '',
            },
          ];
        })
        .sort((a, b) => a.birthday.localeCompare(b.birthday) || a.name.localeCompare(b.name, 'ru')),
      true,
    );
    result.metrics = [
      { label: 'Именинников', value: result.blocks[0].rows.length },
      {
        label: 'Период',
        value: `${f.from.split('-').reverse().join('.')} — ${f.to.split('-').reverse().join('.')}`,
      },
    ];
    result.notes.push(
      'Ближайшие 30 календарных дней включают сегодня и следующие 29 дней по московской дате демочасов. Даты рождения без года или некорректные даты исключены. Для 29 февраля в невисокосном году используется 28 февраля.',
    );
  } else if (id === 'clients_gender_age') {
    const list = filteredVisits.filter((v) => f.onlyPersonal !== '1' || v.kind === 'personal');
    const ageOf = (memberId: number) => {
      const m = memberById.get(String(memberId));
      return m ? reportAge(profile(m).birthDate, f.to) : null;
    };
    const genderOf = (memberId: number) => {
      const m = memberById.get(String(memberId));
      const gender = m ? profile(m).gender : '';
      return gender === 'Мужской' ? 'male' : gender === 'Женский' ? 'female' : 'unknown';
    };
    const rows = grouped(list, (v) => String(ageOf(v.memberId) ?? 'unknown'))
      .sort(([a], [b]) => a.localeCompare(b, 'ru', { numeric: true }))
      .map(([age, entries]) => ({
        id: age,
        name: age === 'unknown' ? 'Возраст не указан' : reportAgeLabel(age),
        ...Object.fromEntries(
          ['male', 'female', 'unknown'].flatMap((key) => {
            const subset = entries.filter((v) => genderOf(v.memberId) === key);
            const clients = countDistinct(subset, (v) => v.memberId);
            return [
              [key, String(f.uniqueOnly === '1' ? clients : subset.length)],
              [`${key}Visits`, String(subset.length)],
              [`${key}Clients`, String(clients)],
              [`${key}Average`, clients ? (subset.length / clients).toFixed(2) : ''],
            ];
          }),
        ),
      }));
    const measure = f.uniqueOnly === '1' ? 'Клиентов' : 'Посещений';
    block(
      'По полу и возрасту',
      [
        col('name', 'Возраст'),
        ...[
          ['male', 'Мужчины'],
          ['female', 'Женщины'],
          ['unknown', 'Пол не указан'],
        ].flatMap(([key, label]) => [
          col(key, `${label} · ${measure.toLowerCase()}`),
          col(`${key}Average`, `${label} · визитов на клиента`),
        ]),
      ],
      rows,
    );
    block(
      'Клиенты по полу и возрасту',
      [
        ...names,
        col('phone', 'Телефон'),
        col('age', 'Возраст'),
        col('gender', 'Пол'),
        col('count', 'Посещений'),
      ],
      grouped(list, (v) => String(v.memberId)).flatMap(([memberId, entries]) => {
        const m = memberById.get(memberId);
        return m
          ? [
              {
                ...person(m),
                age: String(ageOf(m.id) ?? 'Не указан'),
                ageKey: String(ageOf(m.id) ?? 'unknown'),
                genderKey: genderOf(m.id),
                gender: profile(m).gender || 'Не указан',
                count: String(entries.length),
              },
            ]
          : [];
      }),
      true,
    );
    result.metrics = [
      { label: 'Уникальных клиентов', value: countDistinct(list, (v) => v.memberId) },
      { label: 'Посещений', value: list.length },
    ];
    result.notes.push(
      `Зеркальная диаграмма показывает точный возраст на конец периода: мужчины слева, женщины справа. ${f.uniqueOnly === '1' ? 'Один клиент учитывается один раз в выбранных клубах.' : 'Считаются все посещения.'} Среднее всегда означает визиты на одного уникального клиента. Нажмите число в таблице для списка клиентов.`,
      'Неизвестные пол и возраст включены в таблицу и итоги. Невозможный возраст (более 120 лет), будущая или некорректная дата рождения показываются как неизвестные.',
    );
  } else if (id === 'timetoabstat') {
    const passFor = (v: (typeof filteredVisits)[number]) => {
      const m = memberById.get(String(v.memberId));
      if (!m) return undefined;
      const matches = profile(m).subscriptions.filter((p) =>
        v.passId ? p.id === v.passId : p.name === v.plan,
      );
      return matches.length === 1 ? matches[0] : undefined;
    };
    const eventFor = (v: (typeof filteredVisits)[number]) => {
      const receipts = (data['visit-bookings'] || []).filter(
        (r) =>
          r.memberId === String(v.memberId) &&
          localTimestamp(r.date) === v.local &&
          (!v.passId || r.passId === v.passId),
      );
      return receipts.length === 1
        ? (data.events || []).find((e) => e.id === receipts[0].eventId)
        : undefined;
    };
    const programFor = (v: (typeof filteredVisits)[number]) =>
      eventFor(v)?.name || 'Программа не определена';
    const programGroup = (v: (typeof filteredVisits)[number]) => {
      const event = eventFor(v);
      if (!event) return 'Направление не определено';
      const template = (data['training-templates'] || []).find(
        (t) => t.id === event.templateId || t.name === event.name,
      );
      return (
        event.group ||
        template?.group ||
        (event.intensity ? `${event.intensity} интенсивность` : 'Направление не определено')
      );
    };
    for (const [title, key] of [
      ['По клубам', (v: (typeof filteredVisits)[number]) => v.club],
      ['По направлению', (v: (typeof filteredVisits)[number]) => kindNames[v.kind]],
      [
        'По полу',
        (v: (typeof filteredVisits)[number]) => {
          const m = memberById.get(String(v.memberId));
          return m ? profile(m).gender : 'Не указан';
        },
      ],
      [
        'По возрасту',
        (v: (typeof filteredVisits)[number]) => {
          const m = memberById.get(String(v.memberId));
          const age = m ? reportAge(profile(m).birthDate, f.to) : null;
          const bands = [
            [18, 'До 18'],
            [24, '18–23'],
            [30, '24–29'],
            [36, '30–35'],
            [42, '36–41'],
            [48, '42–47'],
            [55, '48–54'],
            [61, '55–60'],
            [67, '61–66'],
            [73, '67–72'],
            [79, '73–78'],
          ] as const;
          return age === null
            ? 'Не указан'
            : bands.find(([end]) => age < end)?.[1] || '79 и старше';
        },
      ],
      ['Популярность групповых программ', programFor],
      [
        'По типам абонементов',
        (v: (typeof filteredVisits)[number]) =>
          getMembershipKind(v.plan, passFor(v)?.kindId)?.name || 'Тип не определён',
      ],
      ['По названиям абонементов', (v: (typeof filteredVisits)[number]) => v.plan],
    ] as const) {
      const list =
        title === 'Популярность групповых программ'
          ? filteredVisits.filter((v) => v.kind === 'group')
          : filteredVisits;
      const denominator = ['По полу', 'По возрасту'].includes(title)
        ? countDistinct(list, (v) => v.memberId)
        : list.length;
      block(
        title,
        [
          col(
            'name',
            title === 'Популярность групповых программ'
              ? 'Программа'
              : title === 'По названиям абонементов'
                ? 'Абонемент'
                : (
                    {
                      'По клубам': 'Клуб',
                      'По направлению': 'Тип посещения',
                      'По полу': 'Пол',
                      'По возрасту': 'Возраст',
                      'По типам абонементов': 'Тип абонемента',
                    } as Record<string, string>
                  )[title] || 'Группа',
          ),
          ...(title === 'Популярность групповых программ'
            ? [col('group', 'Направление / интенсивность')]
            : []),
          col('count', 'Посещений'),
          col('clients', 'Уникальных клиентов'),
          ...(title === 'По названиям абонементов' ? [col('passes', 'Абонементов')] : []),
          col(
            'share',
            ['По полу', 'По возрасту'].includes(title) ? 'Доля клиентов' : 'Доля визитов',
            'percent',
          ),
        ],
        grouped(list, key).map(([name, rows]) => ({
          id: name,
          name,
          count: String(rows.length),
          group: [...new Set(rows.map(programGroup))].join(', '),
          passes: rows.every((v) => passFor(v))
            ? String(countDistinct(rows, (v) => `${v.memberId}|${passFor(v)!.id}`))
            : '',
          clients: String(countDistinct(rows, (v) => v.memberId)),
          share: String(
            pct(
              ['По полу', 'По возрасту'].includes(title)
                ? countDistinct(rows, (v) => v.memberId)
                : rows.length,
              denominator,
            ),
          ),
        })),
      );
      if (title === 'По возрасту') {
        const order = (name: string) =>
          name === 'До 18' ? 0 : Number(name.match(/^\d+/)?.[0] ?? Infinity);
        result.blocks.at(-1)!.rows.sort((a, b) => order(a.name) - order(b.name));
      }
    }
    const groupVisits = filteredVisits.filter((v) => v.kind === 'group');
    block(
      'Направления групповых программ',
      [
        col('name', 'Направление / интенсивность'),
        col('count', 'Посещений'),
        col('clients', 'Уникальных клиентов'),
        col('share', 'Доля групповых визитов', 'percent'),
      ],
      grouped(groupVisits, programGroup).map(([name, rows]) => ({
        id: name,
        name,
        count: String(rows.length),
        clients: String(countDistinct(rows, (v) => v.memberId)),
        share: String(pct(rows.length, groupVisits.length)),
      })),
    );
    result.metrics = [
      { label: 'Посещений', value: filteredVisits.length },
      { label: 'Уникальных клиентов', value: countDistinct(filteredVisits, (v) => v.memberId) },
    ];
    result.notes.push(
      'Возраст рассчитан на конец периода; возрастные группы соответствуют источнику. Пол и возраст — уникальные клиенты, остальные распределения — посещения. В каждой таблице также показано число визитов и уникальных клиентов. Уникальные клиенты разных программ и типов карт могут пересекаться; их строки нельзя складывать. Тип и название карты показаны отдельно. Групповая программа определяется только по квитанции конкретного посещения: без точной связи она неизвестна, а не подставляется из предзаписи. Направления программ и их состав показаны отдельно. Число абонементов — разные списанные карты, а не число покупок; если точная карта неизвестна, показано —.',
    );
  } else if (id === 'visit_by_period') {
    if ((Date.parse(f.to) - Date.parse(f.from)) / dayMs > 365)
      return { ...result, error: 'Для дневного графика выберите период не длиннее 366 дней.' };
    const clubs =
      f.club === 'all'
        ? [...new Set([...Object.values(clubNames), ...filteredVisits.map((v) => v.club)])].sort()
        : [f.club];
    const today = reportDay(at);
    const days: string[] = [];
    for (let day = f.from; day <= f.to; day = reportNextDay(day, 1)) days.push(day);
    const dailyRows = days.map((day): DemoRecord => {
      const list = filteredVisits.filter((v) => v.local.slice(0, 10) === day);
      const future = day > today;
      return {
        id: day,
        day,
        name: day,
        total: future ? '' : String(list.length),
        ...Object.fromEntries(
          clubs.map((club, i) => [
            `club${i}`,
            future ? '' : String(list.filter((v) => v.club === club).length),
          ]),
        ),
      };
    });
    block(
      'Посещения по дням и клубам',
      [
        col('day', 'День', 'date'),
        col('total', 'Всего'),
        ...clubs.map((club, i) => col(`club${i}`, club)),
      ],
      dailyRows,
    );
    const elapsedVisits = filteredVisits.filter((v) => v.local.slice(0, 10) <= today);
    const elapsedDays = days.filter((day) => day <= today).length;
    result.metrics = [
      { label: 'Посещений за месяц', value: elapsedDays ? elapsedVisits.length : '—' },
      {
        label: 'Уникальных клиентов',
        value: elapsedDays ? countDistinct(elapsedVisits, (v) => v.memberId) : '—',
      },
      {
        label: 'В среднем за прошедший день',
        value: elapsedDays ? (elapsedVisits.length / elapsedDays).toFixed(1) : '—',
      },
    ];
    result.notes.push(
      'Выбран один календарный месяц. По горизонтали — дни месяца, линии — итог и каждый клуб. Таблица использует те же значения. Будущие дни показаны как — и не участвуют в среднем. Ноль в прошедшем дне означает отсутствие сохранённых демовизитов; история прототипа неполная.',
    );
  } else if (['clients_new', 'newclients', 'newclients_source'].includes(id)) {
    const rows = members
      .map((m): DemoRecord => {
        const firstVisit =
          allVisits
            .filter((v) => v.memberId === m.id)
            .map((v) => v.local.slice(0, 10))
            .sort()[0] || '';
        const firstBuy =
          ledger
            .filter((s) => resolveBuyer(s)?.id === m.id)
            .map((s) => s.date)
            .sort()[0] || '';
        const registered = reportDay(m.joined);
        return {
          ...person(m),
          registered,
          firstVisit,
          firstBuy,
          source: profile(m).source,
          birthday: reportDay(profile(m).birthDate),
          criterion:
            f.criterion === 'visit'
              ? firstVisit
              : f.criterion === 'purchase'
                ? firstBuy
                : registered,
        };
      })
      .filter((r) => inPeriod(id === 'clients_new' ? r.criterion : r.registered))
      .filter(
        (r) =>
          (f.source === 'all' || r.source === f.source) &&
          (f.onlyNoPurchase !== '1' || !r.firstBuy) &&
          (f.onlyOnline !== '1' ||
            (data['client-sources'] || []).some(
              (s) => s.memberId === r.memberId && s.online === 'true',
            )),
      );
    if (id === 'newclients_source')
      block(
        'Источники регистраций',
        [col('name', 'Источник'), col('count', 'Клиентов')],
        grouped(rows, (r) => r.source).map(([name, list]) => ({
          id: name,
          name,
          count: String(list.length),
        })),
      );
    else
      block(
        'Новые клиенты',
        [
          ...names,
          col('registered', 'Регистрация', 'date'),
          col('firstBuy', 'Первая покупка', 'date'),
          col('firstVisit', 'Первый визит', 'date'),
          col('source', 'Источник'),
        ],
        rows,
        true,
      );
    result.notes.push(
      'Первая покупка и первый визит — первые известные записи в памяти прототипа, а не полная история клуба. Регистрация не привязана к клубу, поэтому клубный фильтр здесь не применяется.',
    );
  } else if (id === 'client_never') {
    const eligible = members.filter(
      (m) =>
        reportDay(m.joined) <= f.to &&
        passes.some(
          (p) =>
            p.memberId === String(m.id) &&
            getMembershipKind(p.name, p.kindId) &&
            reportDay(p.boughtAt) <= f.to &&
            p.status !== 'paused' &&
            p.remaining !== 0 &&
            (!p.endsAt || reportDay(p.endsAt) >= f.to) &&
            ((!p.activatedAt && p.status === 'pending') ||
              (p.activatedAt && reportDay(p.activatedAt) <= f.to)),
        ),
    );
    const directions =
      f.kind === 'personal' ? ['personal'] : f.kind === 'group' ? ['group'] : ['gym', 'personal'];
    const rows = eligible
      .filter(
        (m) =>
          !allVisits.some(
            (v) =>
              v.memberId === m.id &&
              v.local.slice(0, 10) <= f.to &&
              inClub(v.club) &&
              directions.includes(v.kind),
          ),
      )
      .map(person);
    block('Клиенты без посещений направления', [...names, col('phone', 'Телефон')], rows, true);
    result.metrics = [
      { label: 'С действующей или неактивированной картой', value: eligible.length },
      { label: 'Не посещали выбранное направление', value: rows.length },
    ];
    result.notes.push(
      'Проверяется вся известная история до выбранной даты. В выборке клиенты с действующим либо неактивированным абонементом, а не вся база. Первая выборка требует отсутствия и тренажёрного зала, и персональных тренировок. Клуб ограничивает историю визитов; при «Все клубы» проверяется сеть. Услуги проката абонементами не считаются.',
    );
  } else if (id === 'clients_active') {
    const active = members.filter((m) =>
      passes.some(
        (p) =>
          p.memberId === String(m.id) &&
          p.activatedAt &&
          reportDay(p.activatedAt) <= f.to &&
          (!p.endsAt || reportDay(p.endsAt) >= f.to) &&
          p.status !== 'paused' &&
          (f.includePersonal === '1' || p.kindId !== 'personal') &&
          (f.includeSingle === '1' || !['single', 'guest'].includes(p.kindId || '')) &&
          (f.includeCorporate === '1' || !/корпоратив/i.test((p.training || '') + ' ' + p.name)) &&
          (f.onlyUnlimited !== '1' || p.remaining === null) &&
          p.remaining !== 0,
      ),
    );
    const rows = active
      .filter(
        (m) =>
          id === 'clients_active' ||
          !scopedVisits.some((v) => v.memberId === m.id && v.local.slice(0, 10) <= f.to),
      )
      .map(person);
    block(
      id === 'clients_active' ? 'Клиенты с действующей картой на дату' : 'Без известных посещений',
      [...names, col('phone', 'Телефон')],
      rows,
      true,
    );
    result.notes.push(
      'Активный клиент имеет активированную незамороженную карту с остатком на выбранную дату. В прототипе нет полной истории заморозок и старых остатков. Для «не посещали» проверяется вся известная история до даты, а не только выбранный период.',
    );
  } else if (['client_lastvisit', 'client_lastvisit_personal'].includes(id)) {
    const personal = id.endsWith('personal');
    block(
      'Без визитов более указанного срока',
      [
        ...names,
        col('phone', 'Телефон'),
        col('last', 'Последний визит', 'date'),
        col('days', 'Дней без визита'),
      ],
      members
        .map((m) => {
          const last = lastVisit(m.id, personal);
          return {
            ...person(m),
            last,
            days: last ? String(Math.floor((Date.parse(f.to) - Date.parse(last)) / dayMs)) : '',
          };
        })
        .filter((r) => r.last && Number(r.days) > Number(f.threshold)),
      true,
    );
    result.notes.push(
      'Клиенты без единого известного визита не считаются потерянными: для них есть отдельный отчёт «Клиенты не посещали».',
    );
  } else if (id === 'report_all_clients_phones') {
    block(
      'Контакты',
      [...names, col('phone', 'Телефон'), col('sms', 'Согласие на СМС')],
      members.map((m) => ({ ...person(m), sms: profile(m).smsConsent ? 'Есть' : 'Нет' })),
      true,
    );
    result.notes.push(
      'Это просмотр контактов, а не отправка рассылки. Согласие проверяется отдельно. Период и клуб не применяются к общей базе контактов.',
    );
  } else if (id === 'calls') {
    const rows = (data.calls || [])
      .filter(
        (r) =>
          inPeriod(reportDay(r.time.slice(0, 10))) &&
          inClub(r.club || 'Не указан') &&
          (f.callStatus === 'all' || r.status === f.callStatus) &&
          (f.onlyUnknown !== '1' || !memberById.has(r.memberId)),
      )
      .map((r) => {
        const m = memberById.get(r.memberId);
        const phone = r.phone || m?.phone || '';
        return {
          ...r,
          memberId: m ? String(m.id) : '',
          name: m ? clientName(m) : 'Нет в базе',
          phone: input.hidePhones ? hiddenPhone(phone) : phone,
          club: r.club || 'Не указан',
          targetPhone: r.targetPhone || '',
          messenger: r.hasMessenger === 'true' ? 'Есть' : '—',
          recording: r.recordingUrl ? 'Есть запись' : 'Нет записи',
        };
      }) as DemoRecord[];
    block(
      'Журнал звонков',
      [
        col('time', 'Время'),
        col('club', 'Клуб'),
        col('name', 'Клиент'),
        col('phone', 'Телефон клиента'),
        col('direction', 'Направление'),
        col('status', 'Статус'),
        col('targetPhone', 'Номер клуба'),
        col('duration', 'Длительность'),
        col('messenger', 'Мессенджер'),
        col('recording', 'Запись разговора'),
      ],
      rows,
    );
    result.metrics = [
      { label: 'Звонков за период', value: rows.length },
      { label: 'Без клиента в базе', value: rows.filter((r) => !r.memberId).length },
      {
        label: 'Пропущенных',
        value: rows.filter((r) => ['Пропущен', 'Не дозвонились'].includes(r.status)).length,
      },
    ];
    result.notes.push(
      'Имя открывает карточку, телефон — окно демонстрационного звонка. Телефоны клиентов скрываются согласно роли. Номер клуба показан отдельно. Аудиозаписи источника не копируются: локальный плеер доступен только при наличии демонстрационного файла.',
    );
  } else if (['selling_stat', 'finbyyear', 'finbyyear_by_abonements'].includes(id)) {
    const refunds = cashJournal([], cashMovements).filter(
      (r) => r.kind === 'refund' && inPeriod(r.date) && inClub(r.club),
    );
    const returned = refunds.reduce((n, r) => n + r.cash + r.card + r.website + r.gift, 0);
    result.metrics = [
      { label: 'Сумма продаж', value: currency(totalSales) },
      { label: 'Продаж', value: sales.length },
      {
        label: 'Возвраты за период',
        value: currency(returned),
        note: 'Показаны отдельно, без распределения по тарифам',
      },
    ];
    const list =
      id === 'finbyyear_by_abonements' ? sales.filter((s) => s.category === 'Абонементы') : sales;
    const sum = list.reduce((n, s) => n + cashCents(s.amount), 0);
    result.metrics[0].value = currency(sum);
    result.metrics[1].value = list.length;
    const dimension = id === 'finbyyear' ? 'month' : f.grouping;
    const label =
      dimension === 'month'
        ? 'Месяц'
        : dimension === 'day'
          ? 'Дата'
          : dimension === 'club'
            ? 'Клуб'
            : dimension === 'category'
              ? 'Категория'
              : 'Позиция';
    block(
      'Распределение продаж',
      [
        col('name', label),
        col('count', 'Продаж'),
        col('amount', 'Сумма продаж', 'money'),
        col('share', 'Доля суммы', 'percent'),
      ],
      grouped(list, (s) =>
        dimension === 'month'
          ? s.date.slice(0, 7)
          : dimension === 'day'
            ? s.date
            : dimension === 'club'
              ? s.club
              : dimension === 'category'
                ? s.category
                : s.name,
      ).map(([name, rows]) => ({
        id: name,
        name,
        count: String(rows.length),
        amount: String(rows.reduce((n, s) => n + cashCents(s.amount), 0)),
        share: String(
          pct(
            rows.reduce((n, s) => n + cashCents(s.amount), 0),
            sum,
          ),
        ),
      })),
    );
    if (id === 'finbyyear') {
      const b = result.blocks.at(-1)!;
      const months: string[] = [];
      for (let month = f.from.slice(0, 7); month <= f.to.slice(0, 7);) {
        months.push(month);
        const next = new Date(`${month}-01T00:00:00Z`);
        next.setUTCMonth(next.getUTCMonth() + 1);
        month = next.toISOString().slice(0, 7);
      }
      b.rows = months.map(
        (month) =>
          b.rows.find((r) => r.id === month) || {
            id: month,
            name: month,
            count: '0',
            amount: '0',
            share: '0',
          },
      );
    }
    const previous = previousReportPeriod(f.from, f.to);
    if (f.compare === 'previous' && previous) {
      const amount = ledger
        .filter(
          (s) =>
            (!s.kind || s.kind === 'sale') &&
            s.date >= previous.from &&
            s.date <= previous.to &&
            inClub(s.club) &&
            (id !== 'finbyyear_by_abonements' || s.category === 'Абонементы'),
        )
        .reduce((n, s) => n + cashCents(s.amount), 0);
      result.metrics.push({
        label: 'Предыдущий период',
        value: currency(amount),
        note: amount
          ? `${Math.round((sum / amount - 1) * 100)}% · ${previous.from} — ${previous.to}`
          : 'В предыдущем периоде продаж нет; процент не рассчитывается',
      });
    }
    result.notes.push(
      'Сумма продаж по цене сделки, включая подарочную оплату и долг. Внесения на счёт не считаются продажей. Это не бухгалтерская прибыль. Возвраты не вычитаются из произвольного тарифа без связи с исходной продажей.',
    );
  } else if (id === 'kassacontrol') {
    const rows = cashJournal(ledger, cashMovements).filter(
      (r) => inPeriod(r.date) && inClub(r.club),
    );
    const movements = rows.filter((r) => r.kind === 'deposit' || r.kind === 'withdrawal');
    result.metrics = [
      {
        label: 'Поступило денег',
        value: currency(rows.reduce((n, r) => n + cashFlow(r).income, 0)),
      },
      { label: 'Выдано денег', value: currency(rows.reduce((n, r) => n + cashFlow(r).expense, 0)) },
    ];
    block(
      'Внесения и снятия: одна касса',
      [
        col('date', 'Дата', 'date'),
        col('club', 'Клуб'),
        col('name', 'Операция'),
        col('income', 'Внесено', 'money'),
        col('expense', 'Снято', 'money'),
        col('cashier', 'Сотрудник'),
      ],
      movements.map((r) => ({
        id: r.id,
        date: r.date,
        club: r.club,
        name: r.name,
        income: String(cashFlow(r).income),
        expense: String(cashFlow(r).expense),
        cashier: r.cashier,
      })),
    );
    result.notes.push(
      'Подарочные списания и долг не увеличивают поступления денег. Бар исключён; второй кассы нет.',
    );
  } else if (id === 'selling_clients_new') {
    const list = sales.filter((s) => {
      const m = resolveBuyer(s);
      if (!m || !getMembershipKind(s.name, s.kindId)) return false;
      const criterion =
        f.criterion === 'registration'
          ? reportDay(m.joined)
          : f.criterion === 'visit'
            ? allVisits
                .filter((v) => v.memberId === m.id)
                .map((v) => v.local.slice(0, 10))
                .sort()[0] || ''
            : ledger
                .filter((r) => resolveBuyer(r)?.id === m.id)
                .map((r) => r.date)
                .sort()[0] || '';
      const first = ledger
        .filter((r) => resolveBuyer(r)?.id === m.id && getMembershipKind(r.name, r.kindId))
        .sort((a, b) =>
          `${a.date} ${a.time || ''} ${a.id}`.localeCompare(`${b.date} ${b.time || ''} ${b.id}`),
        )[0];
      return inPeriod(criterion) && first?.id === s.id;
    });
    block(
      'Покупки новых клиентов',
      [
        col('date', 'Дата', 'date'),
        col('name', 'Позиция'),
        col('client', 'Клиент'),
        col('amount', 'Сумма', 'money'),
      ],
      list.map((s) => ({
        ...s,
        client: clientName(resolveBuyer(s)!),
        memberId: String(resolveBuyer(s)!.id),
        amount: String(cashCents(s.amount)),
      })),
      true,
    );
    result.notes.push(
      'Новый клиент определяется выбранным событием. Показан только первый известный проданный абонемент клиента, если событие и продажа попали в период. История неполная.',
    );
  } else if (id === 'clients_sell_gender_age') {
    const purchases = sales.filter(
      (s) =>
        f.onlyPersonal !== '1' ||
        getMembershipKind(s.name)?.id === 'personal' ||
        /персональ/i.test(s.category),
    );
    const groups = grouped(purchases, (s) => {
      const m = resolveBuyer(s);
      const age = m ? reportAge(profile(m).birthDate, f.to) : null;
      return age === null ? 'Возраст не указан' : String(age);
    }).sort(([a], [b]) => a.localeCompare(b, 'ru', { numeric: true }));
    for (const average of [false, true])
      block(
        average ? 'Средний чек по полу и возрасту' : 'Сумма покупок по полу и возрасту',
        [
          col('name', 'Возраст'),
          col('male', 'Мужчины', 'money'),
          col('female', 'Женщины', 'money'),
          col('unknown', 'Пол не указан', 'money'),
        ],
        groups.map(([age, rows]) => ({
          id: age,
          name: /^\d+$/.test(age) ? reportAgeLabel(age) : age,
          ...Object.fromEntries(
            [
              ['male', 'Мужской'],
              ['female', 'Женский'],
              ['unknown', 'Не указан'],
            ].map(([key, gender]) => {
              const list = rows.filter((r) => {
                const m = resolveBuyer(r);
                const g = m ? profile(m).gender : 'Не указан';
                return gender === 'Не указан' ? !['Мужской', 'Женский'].includes(g) : g === gender;
              });
              return [
                key,
                average && !list.length
                  ? ''
                  : String(
                      Math.round(
                        list.reduce((n, r) => n + cashCents(r.amount), 0) /
                          (average ? list.length : 1),
                      ),
                    ),
              ];
            }),
          ),
        })),
      );
    result.notes.push(
      'Сумма и средний чек разделены. Возраст — на конец периода; пол и точный возраст показаны совместно. Средний чек — сумма сделок / количество сделок, без покупок он неизвестен. Покупатель без связи с базой остаётся в неизвестной группе.',
    );
  } else if (id === 'unlim_avg_visit') {
    const unlimited = filteredVisits.filter((v) => {
      const m = memberById.get(String(v.memberId));
      return Boolean(
        m &&
        profile(m).subscriptions.some(
          (p) =>
            (v.passId ? p.id === v.passId : p.name === v.plan) &&
            p.remaining === null &&
            (f.plan === 'all' || p.name === f.plan),
        ),
      );
    });
    const amounts = members
      .filter((m) =>
        profile(m).subscriptions.some(
          (p) => p.remaining === null && (f.plan === 'all' || p.name === f.plan),
        ),
      )
      .map((m) => ({
        ...person(m),
        count: String(unlimited.filter((v) => v.memberId === m.id).length),
      }));
    block(
      'Частота визитов',
      [col('name', 'Посещений за период'), col('count', 'Клиентов')],
      [
        { name: '0', min: 0, max: 0 },
        { name: '1–4', min: 1, max: 4 },
        { name: '5–8', min: 5, max: 8 },
        { name: '9–12', min: 9, max: 12 },
        { name: '13 и более', min: 13, max: Infinity },
      ].map((b) => ({
        id: b.name,
        name: b.name,
        count: String(
          amounts.filter((r) => Number(r.count) >= b.min && Number(r.count) <= b.max).length,
        ),
      })),
    );
    block(
      'Визиты по безлимитным картам',
      [...names, col('count', 'Посещений')],
      amounts.sort((a, b) => Number(b.count) - Number(a.count)),
      true,
    );
    result.notes.push(
      'Безлимит определяется свойствами карты, а не словом в её названии. При наличии passId используется точная карта списания.',
    );
  } else {
    result.pending =
      'Для этого отчёта нужен отдельный источник данных. Экран каталога сохранён, вымышленные результаты не подставляются.';
  }
  return result;
}

/** Semicolon CSV, UTF-8 BOM and spreadsheet-formula protection. */
export function statisticsCsv(blocks: ReportBlock[]): string {
  const cell = (value: string) =>
    `"${(/^[\s]*[=+\-@]|^[\t\r]/.test(value) ? "'" : '') + value.replaceAll('"', '""')}"`;
  return (
    '\uFEFF' +
    blocks
      .map((b) =>
        [
          cell(b.title),
          b.columns.map((c) => cell(c.label)).join(';'),
          ...b.rows.map((r) => b.columns.map((c) => cell(r[c.key] || '')).join(';')),
        ].join('\r\n'),
      )
      .join('\r\n\r\n')
  );
}
