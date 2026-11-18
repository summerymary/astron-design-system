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
  const trainerKey = (e: DemoRecord) => {
    if (e.trainerId) return e.trainerId;
    const matches = (data['trainer-profiles'] || []).filter((t) => t.name === e.trainer);
    return matches.length === 1 ? matches[0].id : `unknown:${e.id}`;
  };
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
  const events = [...new Map((data.events || []).map((e) => [e.id, e])).values()].filter(
    (e) => !['Отменено', 'Отменена', 'Удалено'].includes(e.status),
  );
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
  const eligibleKind = (p: (typeof cards)[number]) =>
    (f.includePersonal === '1' || p.kind.id !== 'personal') &&
    (f.includeSingle === '1' || !['single', 'guest'].includes(p.kind.id)) &&
    (f.includeCorporate === '1' || !/корпоратив/i.test(p.training + ' ' + p.name)) &&
    (f.onlyUnlimited !== '1' || p.remaining === null);
  const unitPrice = (p: (typeof cards)[number]) => {
    const denominator = p.remaining === null ? p.used : p.used + p.remaining;
    return p.price === null || denominator <= 0 ? null : Math.round(p.price / denominator);
  };

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
  } else if (id === 'clients_ltv' || id === 'clients_ltv_bydate') {
    const debits = (data['account-debits'] || []).filter(
      (r) =>
        r.date <= f.to &&
        (id === 'clients_ltv' || inPeriod(r.date)) &&
        inClub(r.club) &&
        people.has(r.memberId),
    );
    const rows: DemoRecord[] = group(debits, (r) => r.memberId).map(([memberId, list]) => ({
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
    const average = (list: DemoRecord[]) =>
      list.length
        ? String(Math.round(list.reduce((n, r) => n + Number(r.amount), 0) / list.length))
        : '';
    const summary: DemoRecord[] = ['Пол не указан', 'Мужчины', 'Женщины'].map((name, i) => {
      const list = rows.filter((r) => {
        const gender = profile(people.get(r.memberId)!).gender;
        return i === 1
          ? gender === 'Мужской'
          : i === 2
            ? gender === 'Женский'
            : !['Мужской', 'Женский'].includes(gender);
      });
      return { id: name, name, amount: average(list), count: String(list.length) };
    });
    const values = rows.map((r) => Number(r.amount));
    summary.push(
      {
        id: 'minimum',
        name: 'Минимальная сумма',
        amount: values.length ? String(Math.min(...values)) : '',
        count: '',
      },
      {
        id: 'maximum',
        name: 'Максимальная сумма',
        amount: values.length ? String(Math.max(...values)) : '',
        count: '',
      },
      { id: 'average', name: 'Общая средняя', amount: average(rows), count: String(rows.length) },
    );
    block(
      'Сводка LTV',
      [
        col('name', 'Показатель'),
        col('amount', 'Значение', 'money'),
        col('count', 'Клиентов в расчёте'),
      ],
      summary,
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
    const liabilityCandidates = cards.filter(
      (p) => day(p.boughtAt) <= f.to && (!p.endsAt || day(p.endsAt) >= f.to) && p.remaining !== 0,
    );
    const valued = liabilityCandidates.filter(
      (p) =>
        p.price !== null &&
        (!p.activatedAt || day(p.activatedAt) > f.to || p.remaining !== null || p.endsAt),
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
        status:
          !p.activatedAt || day(p.activatedAt) > f.to
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
    const unknown = liabilityCandidates.length - valued.length;
    const pendingRows = cardRows.filter((r) => r.status === 'Не активирован');
    const activeRows = cardRows.filter((r) => r.status !== 'Не активирован');
    block(
      'Сводка обязательств перед клиентами',
      [
        col('name', 'Показатель'),
        col('amount', 'Известная сумма', 'money'),
        col('count', 'Количество'),
        col('average', 'Средний показатель', 'money'),
        col('unknown', 'Без оценки'),
      ],
      [
        ['balances', 'Остаток на лицевых счетах', balances],
        ['gifts', 'Подарочные карты', gifts],
        ['pending', 'Не активированные абонементы', pendingRows],
        ['active', 'Активные абонементы', activeRows],
      ].map(([id, name, list]) => {
        const rr = list as DemoRecord[];
        const missing = ['pending', 'active'].includes(id as string)
          ? liabilityCandidates.filter(
              (p) =>
                !valued.includes(p) &&
                (!p.activatedAt || day(p.activatedAt) > f.to) === (id === 'pending'),
            ).length
          : 0;
        return {
          id: id as string,
          name: name as string,
          amount: String(sum(rr)),
          count: String(rr.length + missing),
          average: rr.length && !missing ? String(Math.round(sum(rr) / rr.length)) : '',
          unknown: String(missing),
        };
      }),
    );
    if (unknown) out.metrics[0].label = 'Известная сумма обязательств';
    out.notes.push(
      'Это обязательства клуба, а не неоплаченные клиентами покупки. Карта без активации учитывается по цене продажи, количественная — по доле оставшихся посещений, безлимитная — по оставшимся дням. Цены исходных демокарт заданы отдельно; история заморозок неполная. Счета и подарочные карты — текущие остатки, не исторический баланс на дату.',
    );
    if (unknown)
      out.notes.push(
        `Нет сохранённой цены или срока для оценки карт: ${unknown}. Их стоимость не приравнивается к нулю и в сумму не включена; среднее такой группы неизвестно.`,
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
    if (!summer && !guest && Number(f.renewalDays) < 1)
      return { ...out, error: 'Окно покупки должно быть не меньше одного дня.' };
    const anchorOf = (p: (typeof cards)[number]) => day(guest ? p.activatedAt! : p.endsAt!);
    const rows = [
      ...new Map(
        cohort
          .filter(
            (p) =>
              inClub(p.club) &&
              (!(summer || guest) || anchorOf(p) <= (day(input.at) < f.to ? day(input.at) : f.to)),
          )
          .sort((a, b) => anchorOf(a).localeCompare(anchorOf(b)) || a.id.localeCompare(b.id))
          .map((p) => [
            summer || guest ? `${p.memberId}:${anchorOf(p).slice(0, 4)}` : p.memberId,
            p,
          ]),
      ).values(),
    ].map((p) => {
      const anchor = day(guest ? p.activatedAt! : p.endsAt!);
      const observation = day(input.at) < f.to ? day(input.at) : f.to;
      const deadline = summer
        ? shiftMonths(anchor, 3)
        : guest
          ? observation
          : shift(anchor, Number(f.renewalDays));
      const next = cards
        .filter(
          (n) =>
            n.memberId === p.memberId &&
            n.id !== p.id &&
            n.kind.id !== 'guest' &&
            eligibleKind(n) &&
            n.price !== null &&
            n.price > 0 &&
            (id === 'selling_clients_secondary'
              ? day(n.boughtAt) >= day(p.boughtAt) && Boolean(n.endsAt) && day(n.endsAt!) > anchor
              : day(n.boughtAt) >= anchor) &&
            day(n.boughtAt) <= deadline &&
            day(n.boughtAt) <= observation,
        )
        .sort((a, b) => day(a.boughtAt).localeCompare(day(b.boughtAt)))[0];
      return {
        ...person(people.get(p.memberId)!),
        plan: p.name,
        anchor,
        deadline,
        next: next?.name || '—',
        bought: next ? day(next.boughtAt) : '',
        nextEnd: next?.endsAt ? day(next.endsAt) : '',
        status: next ? 'Продлил' : deadline > observation ? 'Окно ещё открыто' : 'Не продлил',
      };
    });
    const complete = rows.filter(
        (r) => r.deadline <= (day(input.at) < f.to ? day(input.at) : f.to),
      ),
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
        note: `${completedConversions} из ${complete.length} завершённых окон`,
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
        col('nextEnd', 'Продлено до', 'date'),
      ],
      rows,
      true,
    );
    if (summer || guest) {
      block(
        'Итоги по годам',
        [
          col('name', 'Год'),
          col('count', 'Клиентов'),
          col('converted', guest ? 'Купили карту' : 'Продлили'),
          col('open', 'Окно ещё открыто'),
          col('closed', 'Завершённых окон'),
          col('convertedClosed', 'Покупок в завершённых окнах'),
          col('share', guest ? 'Доля покупок к дате среза' : 'Доля завершённых окон', 'percent'),
        ],
        group(rows, (r) => r.anchor.slice(0, 4)).map(([year, rr]) => {
          const closed = rr.filter(
            (r) => r.deadline <= (day(input.at) < f.to ? day(input.at) : f.to),
          );
          return {
            id: year,
            name: year,
            count: String(rr.length),
            converted: String(rr.filter((r) => r.status === 'Продлил').length),
            open: String(rr.filter((r) => r.status === 'Окно ещё открыто').length),
            closed: String(closed.length),
            convertedClosed: String(closed.filter((r) => r.status === 'Продлил').length),
            share: closed.length
              ? String(
                  Math.round(
                    (closed.filter((r) => r.status === 'Продлил').length / closed.length) * 100,
                  ),
                )
              : '',
          };
        }),
      );
    }
    out.notes.push(
      summer
        ? 'Летняя карта определяется явной отметкой в демоданных. Окно — три календарных месяца от окончания карты, с переносом на последний существующий день месяца. В источнике не раскрыты дополнительные исключения.'
        : guest
          ? 'Уникальные клиенты с гостевым визитом в периоде, по годам визита. Учитывается последующая платная карта до конца периода, ограниченного датой наблюдения. Порог в 30 дней не применяется: его нет в предоставленном источнике. Отсутствие покупки означает только отсутствие к дате среза.'
          : `Демо: учитывается покупка в течение ${f.renewalDays} дней после окончания карты. Покупка заранее также учитывается, если новый срок заканчивается позже исходного. Окно источника для этого отчёта не раскрыто.`,
    );
    out.notes.push(
      summer || guest
        ? 'Один клиент учитывается один раз в каждой годовой группе; используется последняя подходящая карта в году. Группы разных лет не суммируются как уникальные по сети. Открытое окно не считается отказом; история демо неполная.'
        : 'Один клиент учитывается один раз; если в периоде окончились несколько карт, используется последняя. Незавершённые окна не считаются отказом. Возвраты и заморозки требуют полной истории; это предварительная демонстрационная методика.',
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
    let rows: DemoRecord[] = selectedEvents
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
        const recorded = (data['event-finance'] || []).find((r) => r.eventId === e.id);
        if (recorded?.quantityRevenue !== undefined) quantity = cents(recorded.quantityRevenue);
        if (recorded?.unlimitedRevenue !== undefined) unlimited = cents(recorded.unlimitedRevenue);
        if (recorded?.quantityRevenue !== undefined && recorded?.unlimitedRevenue !== undefined)
          unknown = Number(recorded.unpriced || 0);
        return {
          id: e.id,
          date: e.day + (e.time ? 'T' + e.time : ''),
          name: e.name,
          trainer:
            e.trainer ||
            (data['trainer-profiles'] || []).find((t) => t.id === trainerKey(e))?.name ||
            'Не определён',
          trainerId: trainerKey(e),
          tariff: recorded?.tariff !== undefined ? String(cents(recorded.tariff)) : '',
          lessons: '1',
          avgVisitors: e.present !== undefined ? String(count) : '',
          count: e.present !== undefined ? String(count) : '',
          quantity:
            recorded?.quantityRevenue !== undefined || e.present !== undefined
              ? String(quantity)
              : '',
          unlimited:
            recorded?.unlimitedRevenue !== undefined || e.present !== undefined
              ? String(unlimited)
              : '',
          amount:
            (recorded?.quantityRevenue !== undefined && recorded?.unlimitedRevenue !== undefined) ||
            e.present !== undefined
              ? String(quantity + unlimited)
              : '',
          average: count && !unknown ? String(Math.round((quantity + unlimited) / count)) : '',
          unknown: String(unknown),
        };
      });
    if (f.groupByTrainer === '1' || f.grouping === 'program')
      rows = group(rows, (r) => (f.grouping === 'program' ? r.name : r.trainerId)).map(
        ([key, entries]) => {
          const sum = (field: string) => entries.reduce((n, r) => n + Number(r[field]), 0);
          const count = sum('count'),
            unknown = sum('unknown'),
            amount = sum('amount');
          return {
            id: key,
            trainerId: key,
            trainer: [...new Set(entries.map((r) => r.trainer))].join(', '),
            name: f.grouping === 'program' ? key : entries[0].trainer,
            date: '',
            tariff: entries.every((r) => r.tariff !== '' && r.tariff === entries[0].tariff)
              ? entries[0].tariff
              : '',
            lessons: String(entries.length),
            avgVisitors: entries.every((r) => r.count !== '')
              ? String(Math.round((count / entries.length) * 100) / 100)
              : '',
            count: entries.every((r) => r.count !== '') ? String(count) : '',
            quantity: entries.some((r) => r.quantity !== '') ? String(sum('quantity')) : '',
            unlimited: entries.some((r) => r.unlimited !== '') ? String(sum('unlimited')) : '',
            amount: entries.some((r) => r.amount !== '') ? String(amount) : '',
            average:
              count && !unknown && entries.every((r) => r.count !== '' && r.amount !== '')
                ? String(Math.round(amount / count))
                : '',
            unknown: String(unknown),
          };
        },
      );
    const sortKey =
      f.reportSort === 'all_shedules'
        ? 'lessons'
        : f.reportSort === 'all_visitors'
          ? 'count'
          : 'avgVisitors';
    rows.sort(
      (a, b) =>
        Number(b[sortKey]) - Number(a[sortKey]) ||
        a.trainer.localeCompare(b.trainer, 'ru') ||
        a.date.localeCompare(b.date),
    );
    block(
      'Доход по известным списаниям групп',
      [
        ...(f.groupByTrainer === '1' || f.grouping === 'program'
          ? [
              col('name', f.grouping === 'program' ? 'Программа' : 'Тренер'),
              col('lessons', 'Занятий'),
              col('avgVisitors', 'В среднем посетителей'),
            ]
          : [col('date', 'Дата', 'date'), col('name', 'Занятие'), col('trainer', 'Тренер')]),
        col('tariff', 'Тариф тренера', 'money'),
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
      'Предварительное распределение, не прибыль: количественная карта — цена / исходное число посещений; безлимит — цена / известный счётчик использованных посещений. Неизвестная карта/цена отмечается отдельно, средняя цена не вычисляется при неполных данных. Сохранённые event-finance имеют приоритет перед оценкой; тариф показывается только при явном значении. Без журнала присутствия не подставляется ноль. При разных тарифах в группе единый тариф — прочерк. Группировка и три сортировки сохранены из источника; для среднего числа визитов используется присутствие / число занятий. Метод распределения безлимитов требует согласования с клубом.',
    );
  } else {
    const kindOfSale = (s: DemoRecord) =>
      getMembershipKind(s.name, s.kindId)?.id === 'personal'
        ? 'personal'
        : getMembershipKind(s.name, s.kindId)?.id === 'group'
          ? 'group'
          : 'gym';
    const costs = [...new Map((data['trainer-costs'] || []).map((r) => [r.id, r])).values()].filter(
      (r) =>
        !['Отменено', 'Отменена'].includes(r.status) &&
        inPeriod(r.date) &&
        inClub(r.club) &&
        (f.trainer === 'all' || r.trainerId === f.trainer),
    );
    if (id === 'trener_financial_result') {
      const cutoff = day(input.at) < f.to ? day(input.at) : f.to;
      const personalSales = selectedSales.filter(
        (s) => kindOfSale(s) === 'personal' && s.date <= cutoff,
      );
      const personalCosts = costs.filter((c) => c.kind === 'personal' && c.date <= cutoff);
      const months = [
        ...new Set([
          ...personalSales.map((s) => s.date.slice(0, 7)),
          ...personalCosts.map((c) => c.date.slice(0, 7)),
        ]),
      ].sort();
      const knownTrainers = data['trainer-profiles'] || [];
      const trainerIds = [
        ...new Set([
          ...knownTrainers.map((t) => t.id),
          ...personalSales.map((s) => s.trainerId),
          ...personalCosts.map((c) => c.trainerId),
        ]),
      ].filter(Boolean);
      const trainers = trainerIds.map(
        (key) =>
          knownTrainers.find((t) => t.id === key) || {
            id: key,
            name: 'Исторический тренер · ' + key,
            categoryId: '',
          },
      );
      const rows: DemoRecord[] = trainers
        .filter((t) => f.trainer === 'all' || f.trainer === t.id)
        .flatMap((t) =>
          months.map((month) => {
            const revenueEntries = personalSales.filter(
              (s) => s.trainerId === t.id && s.date.startsWith(month),
            );
            const expenseEntries = personalCosts.filter(
              (c) => c.trainerId === t.id && c.date.startsWith(month),
            );
            const revenue = revenueEntries.reduce((n, s) => n + cents(s.total ?? s.amount), 0);
            const expense = expenseEntries.reduce((n, c) => n + cents(c.amount), 0);
            return {
              id: t.id + ':' + month,
              month,
              name: t.name,
              category:
                (data['trainer-categories'] || []).find((c) => c.id === t.categoryId)?.name ||
                'Не указана',
              amount: revenueEntries.length ? String(revenue) : '',
              expense: expenseEntries.length ? String(expense) : '',
              result:
                revenueEntries.length && expenseEntries.length ? String(revenue - expense) : '',
              percent:
                revenueEntries.length && expenseEntries.length && revenue > 0
                  ? String(Math.round((expense / revenue) * 100))
                  : '',
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
      const summary = group(rows, (r) => r.id.split(':')[0]).map(([key, entries]) => {
        const amount = entries.reduce((n, r) => n + Number(r.amount), 0);
        const expense = entries.reduce((n, r) => n + Number(r.expense), 0);
        return {
          id: key,
          name: entries[0].name,
          category: entries[0].category,
          amount: entries.some((r) => r.amount !== '') ? String(amount) : '',
          expense: entries.some((r) => r.expense !== '') ? String(expense) : '',
          percent:
            amount &&
            entries
              .filter((r) => r.amount !== '' || r.expense !== '')
              .every((r) => r.amount !== '' && r.expense !== '')
              ? String(Math.round((expense * 100) / amount))
              : '',
        };
      });
      block(
        'Итоги ПТ за выбранный период',
        [
          col('name', 'Тренер'),
          col('category', 'Категория'),
          col('expense', 'Всего оплата ПТ', 'money'),
          col('amount', 'Всего продажи ПТ', 'money'),
          col('percent', 'Доля оплаты', 'percent'),
        ],
        summary,
      );
      const matrixMonths: string[] = [];
      for (let month = f.from.slice(0, 7); month <= f.to.slice(0, 7);) {
        matrixMonths.push(month);
        const date = new Date(month + '-01T00:00:00Z');
        date.setUTCMonth(date.getUTCMonth() + 1);
        month = date.toISOString().slice(0, 7);
      }
      block(
        'Накопительный результат ПТ',
        [
          col('name', 'Тренер'),
          col('category', 'Категория'),
          ...matrixMonths.flatMap((month) => {
            const label = new Intl.DateTimeFormat('ru', {
              month: 'long',
              year: 'numeric',
              timeZone: 'UTC',
            }).format(new Date(month + '-01'));
            return [
              col(month + ':expense', label + ' · Оплата', 'money'),
              col(month + ':amount', label + ' · Продажи ПТ', 'money'),
              col(month + ':percent', label + ' · Доля оплаты', 'percent'),
            ];
          }),
          col('expense', 'Всего оплата ПТ', 'money'),
          col('amount', 'Всего связанные продажи ПТ', 'money'),
          col('percent', 'Общая доля оплаты', 'percent'),
        ],
        trainers
          .filter((t) => f.trainer === 'all' || f.trainer === t.id)
          .map((t) => {
            const r = summary.find((entry) => entry.id === t.id) || {
              id: t.id,
              name: t.name,
              category:
                (data['trainer-categories'] || []).find((c) => c.id === t.categoryId)?.name ||
                'Не указана',
              expense: '',
              amount: '',
              percent: '',
            };
            return {
              ...r,
              ...Object.fromEntries(
                matrixMonths.flatMap((month) => {
                  const cell = rows.find((entry) => entry.id === r.id + ':' + month);
                  return ['expense', 'amount', 'percent'].map((key) => [
                    month + ':' + key,
                    cell?.[key] || '',
                  ]);
                }),
              ),
            };
          }),
      );
      out.notes.push(
        'Накопительная матрица — с января до выбранного месяца включительно; каждый месяц содержит оплату, связанные продажи ПТ и долю оплаты. «По месяцам» и «Итоги» доступны отдельными вкладками. Доля итога = сумма оплаты / сумма продаж, а не среднее месячных процентов. При отсутствии данных либо нулевом знаменателе — прочерк, без NaN. Категория — текущая из демосправочника.',
        'Включены только персональные продажи с явным trainerId и начисления ПТ; ГП и дежурства исключены. Старые продажи без связи не приписываются текущему тренеру клиента. Показаны известные суммы; неполная история не даёт подтверждённой прибыли.',
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
