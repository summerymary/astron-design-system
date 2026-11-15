import type { DemoRecord } from '../data/workspace';
import { money } from '../data/workspace';
import type { Member, Visit } from '../types';
import { getClientProfile } from '../data/clientProfile';
import { clientName, hiddenPhone } from './client-display';
import { cashCents, cashFlow, cashJournal } from './cash';
import { reportPending } from '../data/statistics';

export type ReportFilters = {
  from: string;
  to: string;
  club: string;
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
};
export const defaultReportFilters: ReportFilters = {
  from: '2026-11-01',
  to: '2026-11-06',
  club: 'all',
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
  return Number(at.slice(0, 4)) - Number(day.slice(0, 4)) - (at.slice(5) < day.slice(5) ? 1 : 0);
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
  for (const key of ['ageFrom', 'ageTo', 'limit', 'threshold'] as const) {
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
  const error = reportFilterError(f);
  if (error) return { ...result, error };
  if (reportPending[id]) return { ...result, pending: reportPending[id] };
  const { data, visits, at } = input;
  const members = input.members.filter((m) => !m.archived);
  const inPeriod = (date: string) => date >= f.from && date <= f.to;
  const inClub = (club: string) => f.club === 'all' || club === f.club;
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
    for (const [title, list] of [
      ['Все направления', filteredVisits],
      ['Персональные посещения', filteredVisits.filter((v) => v.kind === 'personal')],
      ['Другие направления', filteredVisits.filter((v) => v.kind !== 'personal')],
    ] as const) {
      block(
        title,
        [
          col('name', 'Клуб'),
          col('clients', 'Уникальных клиентов'),
          col('new', 'Новых клиентов'),
          col('visits', 'Посещений'),
          col('average', 'Визитов на клиента'),
        ],
        grouped([...list], (v) => v.club).map(([name, rows]) => ({
          id: name,
          name,
          clients: String(countDistinct(rows, (v) => v.memberId)),
          new: String(
            countDistinct(
              rows.filter((v) => {
                const m = memberById.get(String(v.memberId));
                return Boolean(m && inPeriod(reportDay(m.joined)));
              }),
              (v) => v.memberId,
            ),
          ),
          visits: String(rows.length),
          average: (rows.length / countDistinct(rows, (v) => v.memberId)).toFixed(1),
        })),
      );
    }
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
      for (const mid of ids(e.attendees).filter((mid) => !ids(e.present).includes(mid)))
        counts.set(mid, (counts.get(mid) || 0) + 1);
    }
    block(
      'Клиенты с пропусками',
      [...names, col('phone', 'Телефон'), col('count', 'Пропусков')],
      members
        .filter((m) => (counts.get(String(m.id)) || 0) > Number(f.threshold))
        .map((m) => ({ ...person(m), count: String(counts.get(String(m.id))) })),
      true,
    );
    result.notes.push(
      'В деморасчёте пропуск — запись без отметки присутствия после окончания занятия. Отменённые занятия и резерв исключены. Порог строгий: более указанного количества.',
    );
  } else if (id === 'birdthday') {
    const days = Array.from({ length: 4 }, (_, i) => shift(f.to, i));
    block(
      'Ближайшие четыре дня',
      [
        col('birthday', 'День рождения', 'date'),
        ...names,
        col('phone', 'Телефон'),
        col('last', 'Последний визит', 'date'),
      ],
      days.flatMap((day) =>
        members
          .filter((m) => reportDay(profile(m).birthDate).slice(5) === day.slice(5))
          .map((m) => ({ ...person(m), birthday: day, last: lastVisit(m.id) })),
      ),
      true,
    );
  } else if (id === 'timetoabstat' || id === 'clients_gender_age') {
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
          return age === null
            ? 'Не указан'
            : age < 14
              ? 'До 14'
              : age < 24
                ? '14–23'
                : age < 35
                  ? '24–34'
                  : age < 50
                    ? '35–49'
                    : '50 и старше';
        },
      ],
      ['По абонементам', (v: (typeof filteredVisits)[number]) => v.plan],
    ] as const) {
      if (id === 'clients_gender_age' && !['По полу', 'По возрасту'].includes(title)) continue;
      block(
        title,
        [
          col('name', 'Группа'),
          col('count', 'Посещений'),
          col('clients', 'Клиентов'),
          col('share', 'Доля визитов', 'percent'),
        ],
        grouped(filteredVisits, key).map(([name, rows]) => ({
          id: name,
          name,
          count: String(rows.length),
          clients: String(countDistinct(rows, (v) => v.memberId)),
          share: String(pct(rows.length, filteredVisits.length)),
        })),
      );
    }
    result.notes.push(
      'Возраст рассчитан на конец периода; клиенты без даты рождения выделены отдельно. Клубы и направления не объединяются с типами абонементов.',
    );
  } else if (id === 'visit_by_period') {
    block(
      'Посещаемость по месяцам и клубам',
      [
        col('month', 'Месяц'),
        col('name', 'Клуб'),
        col('count', 'Посещений'),
        col('clients', 'Клиентов'),
      ],
      grouped(filteredVisits, (v) => `${v.local.slice(0, 7)}|${v.club}`).map(([key, rows]) => ({
        id: key,
        month: key.split('|')[0],
        name: rows[0].club,
        count: String(rows.length),
        clients: String(countDistinct(rows, (v) => v.memberId)),
      })),
    );
  } else if (['clients_new', 'newclients', 'newclients_source'].includes(id)) {
    const rows = members
      .map((m) => {
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
      .filter((r) => inPeriod(id === 'clients_new' ? r.criterion : r.registered));
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
  } else if (id === 'client_never' || id === 'clients_active') {
    const active = members.filter((m) =>
      passes.some(
        (p) =>
          p.memberId === String(m.id) &&
          p.activatedAt &&
          reportDay(p.activatedAt) <= f.to &&
          (!p.endsAt || reportDay(p.endsAt) >= f.to) &&
          p.status !== 'paused' &&
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
    block(
      'Журнал звонков',
      [
        col('time', 'Время'),
        col('name', 'Клиент'),
        col('direction', 'Направление'),
        col('duration', 'Длительность'),
        col('status', 'Статус'),
      ],
      (data.calls || []).filter((r) => inPeriod(reportDay(r.time.slice(0, 10)))),
    );
    result.notes.push(
      'Аудиозаписи не подключены. Звонки без привязки к клубу не делятся по клубам.',
    );
  } else if (
    ['gtrener_busy', 'ptrener_rating', 'ptrener_rating_all', 'gtrener_rating'].includes(id)
  ) {
    const list = selectedEvents.filter((e) =>
      id === 'ptrener_rating'
        ? e.kind === 'personal'
        : id === 'ptrener_rating_all'
          ? true
          : e.kind !== 'personal',
    );
    block(
      'Тренеры',
      [
        col('name', 'Тренер'),
        col('count', 'Занятий'),
        col('hours', 'Часов по расписанию'),
        col('present', 'Отмечено посещений'),
        col('booked', 'Записано'),
        col('capacity', 'Мест'),
        col('occupancy', 'Заполняемость', 'percent'),
      ],
      grouped(list, trainerKey)
        .map(([key, rows]) => {
          const capacity = rows.reduce((n, e) => n + Number(e.capacity || 0), 0),
            booked = rows.reduce((n, e) => n + Number(e.booked || 0), 0);
          return {
            id: key,
            name: rows[0].trainer,
            count: String(rows.length),
            hours: (rows.reduce((n, e) => n + Number(e.duration || 0), 0) / 60).toFixed(1),
            present: String(rows.reduce((n, e) => n + ids(e.present).length, 0)),
            booked: String(booked),
            capacity: String(capacity),
            occupancy: String(pct(booked, capacity)),
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
            ),
        ),
    );
    result.notes.push(
      'Часы — длительность занятий в расписании, не табель и не оплаченные часы. Заполняемость — записанные места / суммарная вместимость, не среднее процентов. Отменённые занятия исключены.',
    );
  } else if (['report_pclients', 'report_pclients_lost', 'report_pclients_phones'].includes(id)) {
    const assignments = (data['personal-clients'] || []).filter(
      (a) => f.trainer === 'all' || a.trainerId === f.trainer,
    );
    const rows = assignments.flatMap((a) => {
      const m = memberById.get(a.memberId);
      if (!m) return [];
      const personalEvents = events.filter(
        (e) =>
          e.kind === 'personal' &&
          trainerKey(e) === a.trainerId &&
          ids(e.attendees).includes(a.memberId),
      );
      const attended = personalEvents.filter(
        (e) => ids(e.present).includes(a.memberId) && e.day <= f.to,
      );
      const last =
        attended
          .map((e) => e.day)
          .sort()
          .at(-1) || '';
      if (
        id === 'report_pclients_lost' &&
        (!last || last < shift(f.to, -365) || last >= shift(f.to, -21))
      )
        return [];
      const count = personalEvents.filter((e) => inPeriod(e.day)).length;
      if (id !== 'report_pclients_lost' && !count) return [];
      return [
        {
          ...person(m),
          id: a.id,
          trainer:
            (data['trainer-profiles'] || []).find((t) => t.id === a.trainerId)?.name || 'Не указан',
          booked: String(count),
          present: String(attended.filter((e) => inPeriod(e.day)).length),
          last,
        },
      ];
    });
    block(
      'Персональные клиенты',
      [
        ...names,
        col('trainer', 'Тренер'),
        col('phone', 'Телефон'),
        col('booked', 'Записей за период'),
        col('present', 'Отмечено посещений'),
        col('last', 'Последняя отметка', 'date'),
      ],
      rows,
      true,
    );
    result.notes.push(
      'Используются закрепления клиентов и записи к конкретному тренеру. Потерянный: последняя отметка у этого тренера более 21 дня назад, но не более года. Неотмеченная запись не считается состоявшимся посещением.',
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
      return Boolean(m && inPeriod(reportDay(m.joined)));
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
      'Новый клиент в деморасчёте — зарегистрированный за выбранный период. Продажа также должна попадать в этот период.',
    );
  } else if (id === 'clients_sell_gender_age') {
    block(
      'Покупки по полу и возрасту',
      [col('name', 'Группа'), col('count', 'Покупок'), col('amount', 'Сумма', 'money')],
      grouped(sales, (s) => {
        const m = resolveBuyer(s);
        if (!m) return 'Покупатель не определён';
        const p = profile(m),
          age = reportAge(p.birthDate, s.date);
        return `${p.gender} · ${age === null ? 'Возраст не указан' : age < 24 ? 'До 24' : age < 35 ? '24–34' : age < 50 ? '35–49' : '50 и старше'}`;
      }).map(([name, rows]) => ({
        id: name,
        name,
        count: String(rows.length),
        amount: String(rows.reduce((n, s) => n + cashCents(s.amount), 0)),
      })),
    );
  } else if (id === 'fincredits') {
    block(
      'Остаток задолженности',
      [
        col('date', 'Дата', 'date'),
        col('client', 'Клиент'),
        col('name', 'Покупка'),
        col('amount', 'Долг', 'money'),
      ],
      cashJournal(sales, [])
        .filter((r) => r.credit > 0)
        .map((r) => ({
          id: r.id,
          date: r.date,
          client: r.client,
          memberId: r.memberId,
          name: r.name,
          amount: String(r.credit),
        })),
      true,
    );
    result.notes.push(
      'Показан сохранённый в продаже остаток долга; демонстрационный журнал пока не содержит отдельного графика погашений.',
    );
  } else if (id === 'unlim_avg_visit') {
    const unlimited = filteredVisits.filter((v) => {
      const m = memberById.get(String(v.memberId));
      return Boolean(
        m &&
        profile(m).subscriptions.some(
          (p) => (v.passId ? p.id === v.passId : p.name === v.plan) && p.remaining === null,
        ),
      );
    });
    const amounts = members
      .filter((m) => profile(m).subscriptions.some((p) => p.remaining === null))
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
  if (!result.metrics.length && result.blocks.length)
    result.metrics = [
      { label: 'Строк в отчёте', value: result.blocks.reduce((n, b) => n + b.rows.length, 0) },
    ];
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
