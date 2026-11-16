import type { DemoRecord } from '../data/workspace';
import { money } from '../data/workspace';
import { getClientProfile } from '../data/clientProfile';
import { getMembershipKind } from '../data/membership-kinds';
import { clientName, hiddenPhone } from './client-display';
import { cashCents } from './cash';
import { clientSegment, clientSegments } from './client-segments';
import type { ReportColumn, ReportFilters, ReportResult, StatisticsInput } from './statistics';

const day = (v = '') =>
  /^\d{2}\.\d{2}\.\d{4}$/.test(v) ? v.split('.').reverse().join('-') : v.slice(0, 10);
const days = (a: string, b: string) => Math.floor((Date.parse(b) - Date.parse(a)) / 86400000);
export function shiftMonths(d: string, n: number) {
  const date = new Date(d + 'T00:00:00Z');
  const original = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + n);
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(original, last));
  return date.toISOString().slice(0, 10);
}
const shift = (d: string, n: number) =>
  new Date(Date.parse(d) + n * 86400000).toISOString().slice(0, 10);
const clockMinutes = (v: string) => Number(v.slice(0, 2)) * 60 + Number(v.slice(3, 5));
const local = (v: string) =>
  /(?:Z|[+-]\d\d:\d\d)$/.test(v)
    ? new Date(Date.parse(v) + 10800000).toISOString().slice(0, 16)
    : v;
const ids = (v = '') => v.split(',').filter(Boolean);
const col = (key: string, label: string, format?: ReportColumn['format']) => ({
  key,
  label,
  format,
});
const cents = (v: string | undefined) => cashCents(v || '0');
const currency = (n: number) => money(n / 100);
const handled = new Set([
  'feedbacks',
  'client_lifetime',
  'clients_segmetation',
  'report_pclients_stat',
  'free_trener_find',
  'selltovosit',
  'selling_clients_secondary',
  'financeresult',
  'clients_ltv',
  'clients_ltv_bydate',
  'selling_clients_secondary_summer',
  'selling_clients_afterguest',
  'trener_financial_result',
  'fail_finance_report',
  'gt_finance',
  'clients_sell_discount',
  'fincredits',
]);

/** Read-only examples with explicit rules; never query the source or simulate real accounting. */
export function detailedStatistics(
  id: string,
  f: ReportFilters,
  input: StatisticsInput,
): ReportResult | null {
  if (!handled.has(id)) return null;
  const out: ReportResult = { metrics: [], blocks: [], notes: [] };
  const { data } = input;
  const members = input.members.filter((m) => !m.archived);
  const inPeriod = (d: string) => d >= f.from && d <= f.to;
  const inClub = (club: string) => f.club === 'all' || club === f.club;
  const profile = (m: (typeof members)[number]) => getClientProfile(m, data);
  const person = (m: (typeof members)[number]): DemoRecord => ({
    id: String(m.id),
    memberId: String(m.id),
    name: clientName(m),
    card: profile(m).card,
    phone: input.hidePhones ? hiddenPhone(m.phone) : m.phone,
  });
  const people = new Map(members.map((m) => [String(m.id), m]));
  const trainerKey = (e: DemoRecord) =>
    e.trainerId || (data['trainer-profiles'] || []).find((t) => t.name === e.trainer)?.id || '';
  const visits = [...new Map(input.visits.map((v) => [v.id, v])).values()].map((v) => ({
    ...v,
    local: local(v.enteredAt),
  }));
  const sales = (data.ledger || []).filter(
    (s) =>
      s.category !== 'Бар' &&
      (!s.kind || s.kind === 'sale') &&
      !['Отменено', 'Отменена'].includes(s.status),
  );
  const selectedSales = sales.filter((s) => inPeriod(s.date) && inClub(s.club));
  const buyer = (s: DemoRecord) => {
    if (s.memberId) return people.get(s.memberId);
    const found = members.filter((m) => [m.name, clientName(m)].includes(s.client));
    return found.length === 1 ? found[0] : undefined;
  };
  const events = (data.events || []).filter((e) => e.status !== 'Отменено');
  const selectedEvents = events.filter(
    (e) =>
      inPeriod(e.day) && inClub(e.club) && (f.trainer === 'all' || trainerKey(e) === f.trainer),
  );
  const cards = members.flatMap((m) =>
    profile(m)
      .subscriptions.filter((p) => getMembershipKind(p.name, p.kindId))
      .map((p) => {
        const issued = (data['issued-plans'] || []).find((r) => r.id === p.id);
        const valuation = (data['report-pass-values'] || []).find(
          (r) => r.passId === p.id && r.memberId === String(m.id),
        );
        const price = issued?.purchasePrice ?? valuation?.price;
        return {
          ...p,
          memberId: String(m.id),
          club: issued?.club || valuation?.club || '',
          price: price === undefined ? null : cents(price),
          summer: valuation?.summer === 'true',
          kind: getMembershipKind(p.name, p.kindId)!,
          trainerId:
            p.trainerId ||
            (data['personal-clients'] || []).find((a) => a.memberId === String(m.id))?.trainerId ||
            '',
        };
      }),
  );
  const block = (title: string, columns: ReportColumn[], rows: DemoRecord[], memberLinks = false) =>
    out.blocks.push({ title, columns, rows, memberLinks });
  const group = <T>(rows: T[], key: (r: T) => string) => {
    const map = new Map<string, T[]>();
    rows.forEach((r) => {
      const k = key(r);
      map.set(k, [...(map.get(k) || []), r]);
    });
    return [...map];
  };
  const names = [col('name', 'Клиент'), col('card', 'Карта')];
  const lastVisit = (memberId: string, personal = false) =>
    visits
      .filter(
        (v) =>
          String(v.memberId) === memberId &&
          v.local.slice(0, 10) <= f.to &&
          (!personal || v.kind === 'personal'),
      )
      .map((v) => v.local.slice(0, 10))
      .sort()
      .at(-1) || '';
  const eligibleKind = (p: (typeof cards)[number]) =>
    (f.includePersonal === '1' || p.kind.id !== 'personal') &&
    (f.includeSingle === '1' || !['single', 'guest'].includes(p.kind.id)) &&
    (f.includeCorporate === '1' || !/корпоратив/i.test(p.training + ' ' + p.name)) &&
    (f.onlyUnlimited !== '1' || p.remaining === null);
  const unitPrice = (p: (typeof cards)[number]) =>
    p.price === null
      ? null
      : Math.round(p.price / Math.max(1, p.remaining === null ? p.used : p.used + p.remaining));

  if (id === 'feedbacks') {
    const rows: DemoRecord[] = (data['client-reviews'] || [])
      .filter(
        (r) =>
          inPeriod(r.date) && inClub(r.club) && (f.operator === 'all' || r.operator === f.operator),
      )
      .flatMap((r) => {
        const m = people.get(r.memberId);
        return m ? [{ ...r, ...person(m), id: r.id }] : [];
      });
    block(
      'Отзывы клиентов',
      [
        col('date', 'Дата', 'date'),
        ...names,
        col('text', 'Отзыв'),
        col('operator', 'Оператор'),
        col('rating', 'Оценка'),
      ],
      rows,
      true,
    );
    out.metrics = [
      { label: 'Отзывов', value: rows.length },
      {
        label: 'Средняя оценка',
        value: rows.length
          ? (rows.reduce((n, r) => n + Number(r.rating), 0) / rows.length).toFixed(1)
          : '—',
      },
    ];
  } else if (id === 'client_lifetime') {
    const interval = Number(f.threshold);
    if (interval < 1)
      return { ...out, error: 'Интервал бездействия должен быть не меньше одного дня.' };
    const rows = members.flatMap((m) => {
      const history = visits
        .filter(
          (v) =>
            v.memberId === m.id &&
            v.local.slice(0, 10) <= f.to &&
            (f.club === 'all' ||
              ({ central: 'Центральный', park: 'Парк', river: 'Речной' }[v.clubId] || v.clubId) ===
                f.club),
        )
        .map((v) => v.local.slice(0, 10))
        .sort();
      if (!history.length) return [];
      const first = history[0],
        last = history.at(-1)!,
        finished = days(last, f.to) >= interval;
      return [
        {
          ...person(m),
          first,
          last,
          end: finished ? shift(last, interval) : '',
          count: String(days(first, finished ? shift(last, interval) : f.to) + 1),
          status: finished ? 'Завершённое наблюдение' : 'Клиент продолжает посещать',
          gender: profile(m).gender,
        },
      ];
    });
    const closed = rows.filter((r) => r.end);
    out.metrics = [
      { label: 'Завершённых наблюдений', value: closed.length },
      { label: 'Продолжают посещать', value: rows.length - closed.length },
      {
        label: 'Среднее завершённое время, дней',
        value: closed.length
          ? (closed.reduce((n, r) => n + Number(r.count), 0) / closed.length).toFixed(1)
          : '—',
      },
    ];
    block(
      'Известная история посещений',
      [
        ...names,
        col('first', 'Первый известный визит', 'date'),
        col('last', 'Последний визит', 'date'),
        col('end', 'Конец наблюдения', 'date'),
        col('count', 'Дней наблюдения'),
        col('status', 'Состояние'),
      ],
      rows,
      true,
    );
    block(
      'Завершённое время по полу',
      [col('name', 'Пол'), col('count', 'Клиентов'), col('average', 'Среднее, дней')],
      group(closed, (r) => r.gender).map(([name, list]) => ({
        id: name,
        name,
        count: String(list.length),
        average: (list.reduce((n, r) => n + Number(r.count), 0) / list.length).toFixed(1),
      })),
    );
    out.notes.push(
      'Демонстрационная методика: начало — первый известный визит; окончание — последний визит + интервал бездействия. Продолжающие посещать не включаются в среднее завершённое время. Это неполная история и не подтверждённая серверная формула источника.',
    );
  } else if (id === 'clients_segmetation') {
    const rows = members
      .filter((m) => day(m.joined) <= f.to)
      .map((m) => {
        const state = clientSegment(
          cards.filter((p) => p.memberId === String(m.id)),
          f.to,
        );
        return {
          ...person(m),
          segment: clientSegments[state.index].name,
          segmentId: String(state.index),
          ended: state.ended,
          days: state.days,
        };
      });
    block(
      'Сегменты базы',
      [
        col('name', 'Сегмент'),
        col('rule', 'Условие'),
        col('count', 'Клиентов'),
        col('share', 'Доля базы', 'percent'),
      ],
      clientSegments.map((segment, i) => {
        const count = rows.filter((r) => r.segmentId === String(i)).length;
        return {
          id: String(i),
          name: segment.name,
          rule: segment.rule,
          count: String(count),
          share: rows.length ? ((count * 100) / rows.length).toFixed(1) : '',
        };
      }),
    );
    block(
      'Клиенты сегмента',
      [
        ...names,
        col('phone', 'Телефон'),
        col('segment', 'Сегмент'),
        col('ended', 'Окончание абонемента', 'date'),
        col('days', 'Дней после окончания'),
      ],
      rows.filter((r) => f.segment === 'all' || r.segmentId === f.segment),
      true,
    );
    out.metrics = [
      { label: 'Клиентов в базе на дату', value: rows.length },
      { label: 'С действующим абонементом', value: rows.filter((r) => r.segmentId === '0').length },
      { label: 'Без достаточной истории', value: rows.filter((r) => r.segmentId === '8').length },
    ];
    out.notes.push(
      'Сегменты определяются абонементами на выбранную дату, а не визитами. Приоритет: действующий, неактивированный, затем давность окончания последнего абонемента. Каждый клиент входит в один сегмент. Замороженная текущая карта или неизвестная дата окончания — «Недостаточно данных».',
      'Границы из источника: 1–30, 31–90, 91–180, 181–365, 366–1095 и 1096+ дней. В прототипе используется известное окончание абонемента; история покупок и прошлых остатков неполная. Сводка показана полосами вместо восьми секторов, чтобы точнее сравнивать небольшие сегменты.',
    );
  } else if (id === 'report_pclients_stat') {
    const rows = (data['personal-clients'] || [])
      .filter((a) => f.trainer === 'all' || a.trainerId === f.trainer)
      .flatMap((a) => {
        const m = people.get(a.memberId);
        if (!m) return [];
        const last = lastVisit(a.memberId, true);
        return [
          {
            ...person(m),
            id: a.id,
            trainer:
              (data['trainer-profiles'] || []).find((t) => t.id === a.trainerId)?.name ||
              'Не указан',
            last,
            status: !last
              ? 'Нет истории ПТ'
              : days(last, f.to) > Number(f.threshold)
                ? 'Потерянный'
                : 'Активный',
          },
        ];
      });
    const known = rows.filter((r) => r.last && r.last >= f.from),
      lost = known.filter((r) => r.status === 'Потерянный').length;
    out.metrics = [
      { label: 'Клиентов с известной историей', value: known.length },
      { label: 'Активных', value: known.length - lost },
      { label: 'Потерянных', value: lost },
      {
        label: 'Доля потерянных',
        value: known.length ? `${Math.round((lost / known.length) * 100)}%` : '—',
      },
    ];
    block(
      'Клиенты и состояние',
      [
        ...names,
        col('trainer', 'Закреплённый тренер'),
        col('last', 'Последний ПТ-визит', 'date'),
        col('status', 'Состояние'),
      ],
      rows,
      true,
    );
    out.notes.push(
      'Демо: потеря — более указанного числа дней без известного ПТ-визита. Знаменатель — клиенты с последним визитом не раньше стартовой даты. Без истории не считаются потерянными. Используется текущее закрепление; историю смены тренеров нужно хранить отдельно.',
    );
  } else if (id === 'free_trener_find') {
    const start = clockMinutes(f.timeFrom),
      duration = Number(f.duration);
    if (duration < 1 || duration > 240 || start + duration > 1440)
      return { ...out, error: 'Укажите длительность 1–240 минут в пределах выбранного дня.' };
    const rows = (data['trainer-availability'] || [])
      .filter(
        (s) =>
          s.day === f.to &&
          inClub(s.club) &&
          (f.trainer === 'all' || s.trainerId === f.trainer) &&
          clockMinutes(s.time) <= start &&
          clockMinutes(s.end) >= start + duration,
      )
      .flatMap((s) => {
        const t = (data['trainer-profiles'] || []).find(
          (t) => t.id === s.trainerId && t.status !== 'В архиве',
        );
        const busy = events.some(
          (e) =>
            e.day === f.to &&
            trainerKey(e) === s.trainerId &&
            clockMinutes(e.time) < start + duration &&
            start < clockMinutes(e.time) + Number(e.duration),
        );
        if (!t || busy) return [];
        return [
          {
            id: s.id,
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
      });
    block(
      'Свободные тренеры в рабочее время',
      [
        col('name', 'Тренер'),
        col('category', 'Категория'),
        col('club', 'Клуб'),
        col('date', 'Дата', 'date'),
        col('time', 'Начало'),
        col('duration', 'Минут'),
      ],
      rows,
    );
    out.notes.push(
      'Проверяются явно заданное рабочее окно и пересечения с занятиями во всех клубах. Нет окна в демоданных — доступность неизвестна, тренер не предлагается. Это просмотр, он не создаёт запись.',
    );
  } else if (id === 'clients_ltv' || id === 'clients_ltv_bydate') {
    const debits = (data['account-debits'] || []).filter(
      (r) =>
        r.date <= f.to &&
        (id === 'clients_ltv' || inPeriod(r.date)) &&
        inClub(r.club) &&
        people.has(r.memberId),
    );
    const rows = group(debits, (r) => r.memberId).map(([memberId, list]) => ({
      ...person(people.get(memberId)!),
      amount: String(list.reduce((n, r) => n + cents(r.amount), 0)),
      count: String(list.length),
    }));
    const total = rows.reduce((n, r) => n + Number(r.amount), 0);
    out.metrics = [
      { label: 'Клиентов со списаниями', value: rows.length },
      { label: 'Списано со счетов', value: currency(total) },
      {
        label: 'Средние расходы клиента',
        value: rows.length ? currency(Math.round(total / rows.length)) : '—',
      },
    ];
    block(
      'Расходы клиентов с лицевых счетов',
      [...names, col('count', 'Списаний'), col('amount', 'Расходы', 'money')],
      rows,
      true,
    );
    out.notes.push(
      'Воспроизведено пояснение страницы источника: средняя сумма списаний с лицевых счетов клиентов с известными списаниями. Это не прибыль и не общая сумма покупок. Описание каталога источника противоречит странице. Все операции вымышлены.',
    );
  } else if (id === 'fincredits') {
    const balances = members
      .filter((m) => profile(m).balance > 0)
      .map((m) => ({ ...person(m), amount: String(cents(String(profile(m).balance))) }));
    const gifts = (data['gift-cards'] || [])
      .filter((g) => g.status === 'Активна')
      .map((g) => ({ id: g.id, name: g.name, amount: String(cents(g.balance)) }));
    const valued = cards.filter(
      (p) =>
        p.price !== null &&
        day(p.boughtAt) <= f.to &&
        (!p.endsAt || day(p.endsAt) >= f.to) &&
        p.remaining !== 0,
    );
    const cardRows = valued.map((p) => {
      const duration =
        p.activatedAt && p.endsAt ? Math.max(1, days(day(p.activatedAt), day(p.endsAt)) + 1) : null;
      const fraction =
        !p.activatedAt || day(p.activatedAt) > f.to
          ? 1
          : p.remaining !== null
            ? p.remaining / Math.max(1, p.remaining + p.used)
            : duration
              ? Math.max(0, Math.min(1, (days(f.to, day(p.endsAt!)) + 1) / duration))
              : 1;
      return {
        ...person(people.get(p.memberId)!),
        id: p.id,
        plan: p.name,
        status: !p.activatedAt
          ? 'Не активирован'
          : p.status === 'paused'
            ? 'Заморожен'
            : 'Действует',
        amount: String(Math.round(p.price! * fraction)),
      };
    });
    const sum = (rows: DemoRecord[]) => rows.reduce((n, r) => n + Number(r.amount), 0);
    out.metrics = [
      {
        label: 'Обязательства перед клиентами',
        value: currency(sum(balances) + sum(gifts) + sum(cardRows)),
      },
      { label: 'Лицевые счета', value: currency(sum(balances)) },
      { label: 'Подарочные карты', value: currency(sum(gifts)) },
      { label: 'Остаток стоимости абонементов', value: currency(sum(cardRows)) },
    ];
    block(
      'Положительные остатки лицевых счетов',
      [...names, col('amount', 'Остаток', 'money')],
      balances,
      true,
    );
    block(
      'Активные подарочные карты',
      [col('name', 'Карта'), col('amount', 'Остаток', 'money')],
      gifts,
    );
    block(
      'Неиспользованная стоимость абонементов',
      [
        ...names,
        col('plan', 'Абонемент'),
        col('status', 'Состояние'),
        col('amount', 'Остаток стоимости', 'money'),
      ],
      cardRows,
      true,
    );
    const unknown = cards.filter((p) => p.price === null).length;
    out.notes.push(
      'Это обязательства клуба, а не неоплаченные клиентами покупки. Карта без активации учитывается по цене продажи, количественная — по доле оставшихся посещений, безлимитная — по оставшимся дням. Цены исходных демокарт заданы отдельно; история заморозок неполная. Счета и подарочные карты — текущие остатки, не исторический баланс на дату.',
    );
    if (unknown)
      out.notes.push(
        `Нет сохранённой цены у карт: ${unknown}. Их стоимость не приравнивается к нулю и в сумму не включена.`,
      );
  } else if (id === 'clients_sell_discount') {
    const rows = selectedSales
      .filter((s) => s.basePrice !== undefined && s.discountAmount !== undefined)
      .map((s) => ({
        ...s,
        name: buyer(s) ? clientName(buyer(s)!) : s.client || 'Покупатель не определён',
        memberId: buyer(s) ? String(buyer(s)!.id) : '',
        item: s.name,
        original: String(cents(s.basePrice)),
        discount: String(cents(s.discountAmount)),
        amount: String(cents(s.total ?? s.amount)),
      }));
    block(
      'Продажи с известной исходной ценой',
      [
        col('date', 'Дата', 'date'),
        col('name', 'Клиент'),
        col('item', 'Позиция'),
        col('original', 'До скидки', 'money'),
        col('discount', 'Скидка', 'money'),
        col('amount', 'Стоимость', 'money'),
      ],
      rows,
    );
    out.notes.push(
      'Новые демопродажи сохраняют исходную цену и скидку. Старые записи без этих полей исключены: итоговая сумма не доказывает наличие или отсутствие скидки. Продажи без скидки показаны с нулевой скидкой.',
    );
  } else if (
    [
      'selling_clients_secondary',
      'selling_clients_secondary_summer',
      'selling_clients_afterguest',
    ].includes(id)
  ) {
    const guest = id === 'selling_clients_afterguest',
      summer = id === 'selling_clients_secondary_summer';
    const cohort = guest
      ? cards.filter((p) => p.kind.id === 'guest' && p.activatedAt && inPeriod(day(p.activatedAt)))
      : cards.filter(
          (p) => p.endsAt && inPeriod(day(p.endsAt)) && (!summer || p.summer) && eligibleKind(p),
        );
    if (!summer && Number(f.renewalDays) < 1)
      return { ...out, error: 'Окно покупки должно быть не меньше одного дня.' };
    const anchorOf = (p: (typeof cards)[number]) => day(guest ? p.activatedAt! : p.endsAt!);
    const rows = [
      ...new Map(
        cohort
          .filter((p) => inClub(p.club))
          .sort((a, b) => anchorOf(a).localeCompare(anchorOf(b)) || a.id.localeCompare(b.id))
          .map((p) => [p.memberId, p]),
      ).values(),
    ].map((p) => {
      const anchor = day(guest ? p.activatedAt! : p.endsAt!);
      const deadline = summer ? shiftMonths(anchor, 3) : shift(anchor, Number(f.renewalDays));
      const next = cards
        .filter(
          (n) =>
            n.memberId === p.memberId &&
            n.id !== p.id &&
            n.kind.id !== 'guest' &&
            n.price !== null &&
            n.price > 0 &&
            day(n.boughtAt) >= anchor &&
            day(n.boughtAt) <= deadline &&
            day(n.boughtAt) <= f.to,
        )
        .sort((a, b) => day(a.boughtAt).localeCompare(day(b.boughtAt)))[0];
      return {
        ...person(people.get(p.memberId)!),
        plan: p.name,
        anchor,
        deadline,
        next: next?.name || '—',
        bought: next ? day(next.boughtAt) : '',
        status: next ? 'Продлил' : deadline > f.to ? 'Окно ещё открыто' : 'Не продлил',
      };
    });
    const complete = rows.filter((r) => r.deadline <= f.to),
      converted = rows.filter((r) => r.status === 'Продлил').length;
    const completedConversions = complete.filter((r) => r.status === 'Продлил').length;
    out.metrics = [
      { label: 'Клиентов в группе', value: rows.length },
      { label: 'Продлили', value: converted },
      {
        label: 'Окно ещё открыто',
        value: rows.filter((r) => r.status === 'Окно ещё открыто').length,
      },
      {
        label: 'Доля по завершённым окнам',
        value: complete.length
          ? `${Math.round((completedConversions / complete.length) * 100)}%`
          : '—',
      },
    ];
    block(
      'Покупка следующей карты',
      [
        ...names,
        col('plan', 'Исходная карта'),
        col('anchor', guest ? 'Гостевой визит' : 'Окончание карты', 'date'),
        col('deadline', 'Конец окна', 'date'),
        col('status', 'Результат'),
        col('next', 'Новая карта'),
        col('bought', 'Дата покупки', 'date'),
      ],
      rows,
      true,
    );
    out.notes.push(
      summer
        ? 'Летняя карта определяется явной отметкой в демоданных. Окно — три календарных месяца от окончания карты, с переносом на последний существующий день месяца. В источнике не раскрыты дополнительные исключения.'
        : `Демо: учитывается покупка в течение ${f.renewalDays} дней после ${guest ? 'активации гостевой карты' : 'окончания карты'}. Окно источника для этого отчёта не раскрыто.`,
    );
    out.notes.push(
      'Один клиент учитывается один раз; если в периоде окончились несколько карт, используется последняя. Незавершённые окна не считаются отказом. Возвраты и заморозки требуют полной истории; это предварительная демонстрационная методика.',
    );
  } else if (id === 'selltovosit') {
    const rows = cards
      .filter(
        (p) =>
          p.activatedAt &&
          p.endsAt &&
          inPeriod(day(p.activatedAt)) &&
          inPeriod(day(p.endsAt)) &&
          inClub(p.club) &&
          eligibleKind(p),
      )
      .map((p) => {
        const known = visits.filter(
          (v) =>
            v.memberId === Number(p.memberId) &&
            v.passId === p.id &&
            v.local.slice(0, 10) >= day(p.activatedAt!) &&
            v.local.slice(0, 10) <= day(p.endsAt!),
        ).length;
        return {
          id: p.id,
          name: p.name,
          memberId: p.memberId,
          amount: p.price === null ? '' : String(p.price),
          count: String(known),
          average: p.price !== null && known ? String(Math.round(p.price / known)) : '',
        };
      });
    block(
      'Завершённые и активированные в периоде карты',
      [
        col('name', 'Абонемент'),
        col('amount', 'Цена продажи', 'money'),
        col('count', 'Известных списаний'),
        col('average', 'Цена известного посещения', 'money'),
      ],
      rows,
    );
    out.notes.push(
      'Период применяется к активации и окончанию, не к дате покупки. Демо использует только точно связанные passId; цена посещения = цена продажи / число известных списаний. При нуле списаний цена неизвестна. Источник неоднозначно описывает деление; полная история, заморозки и возвраты требуют уточнения.',
    );
  } else if (id === 'fail_finance_report') {
    block(
      'Подтверждённые демонстрационные ошибки',
      [
        col('date', 'Дата', 'date'),
        col('name', 'Продажа'),
        col('code', 'Код'),
        col('description', 'Описание'),
        col('amount', 'Стоимость', 'money'),
      ],
      (data['fiscal-results'] || [])
        .filter((r) => r.status === 'Ошибка' && inPeriod(r.date) && inClub(r.club))
        .flatMap((r) => {
          const sale = sales.find((s) => s.id === r.saleId);
          return sale
            ? [{ ...r, name: sale.name, amount: String(cents(sale.total ?? sale.amount)) }]
            : [];
        }),
    );
    out.notes.push(
      'Исходная страница осталась пустой. Этот пример построен по описанию каталога и явным вымышленным результатам устройства. Реальных запросов ККМ нет; отсутствие номера чека не считается ошибкой. Повторное проведение отсюда недоступно.',
    );
  } else if (id === 'gt_finance') {
    const rows = selectedEvents
      .filter((e) => e.kind !== 'personal')
      .map((e) => {
        let quantity = 0,
          unlimited = 0,
          unknown = 0;
        for (const memberId of new Set(ids(e.present))) {
          const receipt = (data['visit-bookings'] || []).find(
            (r) => r.eventId === e.id && r.memberId === memberId,
          );
          const p = cards.find((p) => p.id === receipt?.passId && p.memberId === memberId);
          const value = p ? unitPrice(p) : null;
          if (!p || value === null) unknown++;
          else if (p.remaining === null) unlimited += value;
          else quantity += value;
        }
        const count = new Set(ids(e.present)).size;
        return {
          id: e.id,
          date: e.day,
          name: e.name,
          trainer: e.trainer,
          count: String(count),
          quantity: String(quantity),
          unlimited: String(unlimited),
          amount: String(quantity + unlimited),
          average: count && !unknown ? String(Math.round((quantity + unlimited) / count)) : '',
          unknown: String(unknown),
        };
      });
    block(
      'Доход по известным списаниям групп',
      [
        col('date', 'Дата', 'date'),
        col('name', 'Занятие'),
        col('trainer', 'Тренер'),
        col('count', 'Присутствовали'),
        col('quantity', 'Количественные', 'money'),
        col('unlimited', 'Безлимитные', 'money'),
        col('average', 'Средняя цена', 'money'),
        col('amount', 'Известный доход', 'money'),
        col('unknown', 'Без цены'),
      ],
      rows,
    );
    out.notes.push(
      'Предварительное распределение, не прибыль: количественная карта — цена / исходное число посещений; безлимит — цена / известный счётчик использованных посещений. Неизвестная карта/цена отмечается отдельно, средняя цена не вычисляется при неполных данных. Метод распределения безлимитов требует согласования с клубом.',
    );
  } else {
    const kindOfSale = (s: DemoRecord) =>
      getMembershipKind(s.name, s.kindId)?.id === 'personal'
        ? 'personal'
        : getMembershipKind(s.name, s.kindId)?.id === 'group'
          ? 'group'
          : 'gym';
    const costs = (data['trainer-costs'] || []).filter(
      (r) =>
        inPeriod(r.date) && inClub(r.club) && (f.trainer === 'all' || r.trainerId === f.trainer),
    );
    if (id === 'trener_financial_result') {
      const months = [
        ...new Set([
          ...selectedSales.map((s) => s.date.slice(0, 7)),
          ...costs.map((c) => c.date.slice(0, 7)),
        ]),
      ].sort();
      const rows = (data['trainer-profiles'] || [])
        .filter((t) => f.trainer === 'all' || f.trainer === t.id)
        .flatMap((t) =>
          months.map((month) => {
            const revenue = selectedSales
                .filter((s) => s.trainerId === t.id && s.date.startsWith(month))
                .reduce((n, s) => n + cents(s.total ?? s.amount), 0),
              expense = costs
                .filter((c) => c.trainerId === t.id && c.date.startsWith(month))
                .reduce((n, c) => n + cents(c.amount), 0);
            return {
              id: t.id + ':' + month,
              month,
              name: t.name,
              category:
                (data['trainer-categories'] || []).find((c) => c.id === t.categoryId)?.name ||
                'Не указана',
              amount: String(revenue),
              expense: String(expense),
              result: String(revenue - expense),
              percent: revenue ? String(Math.round((expense / revenue) * 100)) : '',
            };
          }),
        );
      block(
        'Результат по тренерам и месяцам',
        [
          col('month', 'Месяц'),
          col('name', 'Тренер'),
          col('category', 'Категория'),
          col('amount', 'Связанные продажи ПТ', 'money'),
          col('expense', 'Оплата тренеру', 'money'),
          col('result', 'Разница', 'money'),
          col('percent', 'Доля оплаты', 'percent'),
        ],
        rows,
      );
      out.notes.push(
        'В демо доход отнесён тренеру только по явному trainerId продажи, без распределения по текущему закреплению клиента. Старые продажи без связи не приписываются сотруднику. Это разница связанных продаж и начислений, а не полная прибыль клуба.',
      );
    } else {
      const rows = ['group', 'personal', 'gym'].map((kind) => {
        const revenue = selectedSales
            .filter((s) => kindOfSale(s) === kind)
            .reduce((n, s) => n + cents(s.total ?? s.amount), 0),
          expense = costs
            .filter((c) => (kind === 'gym' ? c.kind === 'duty' : c.kind === kind))
            .reduce((n, c) => n + cents(c.amount), 0);
        return {
          id: kind,
          name: {
            group: 'Групповые программы',
            personal: 'Персональные тренировки',
            gym: 'Тренажёрный зал и ресепшен',
          }[kind]!,
          amount: String(revenue),
          expense: String(expense),
          result: String(revenue - expense),
        };
      });
      block(
        'Продажи и сохранённые начисления',
        [
          col('name', 'Направление'),
          col('amount', 'Стоимость продаж', 'money'),
          col('expense', 'Оплата тренерам и дежурным', 'money'),
          col('result', 'Предварительная разница', 'money'),
        ],
        rows,
      );
      out.notes.push(
        'Демо: стоимость продаж минус явно сохранённые начисления тренерам/дежурным. Это не подтверждённый финансовый результат: аренда, налоги, возвраты и правила признания доходов не включены. Расходы не подменяются нулём: показаны только известные записи, отдельно от выручки. Бар исключён.',
      );
    }
  }
  return out;
}
