import type { DemoRecord } from '../data/workspace';
import { money } from '../data/workspace';
import { getClientProfile } from '../data/clientProfile';
import { getMembershipKind } from '../data/membership-kinds';
import { cashCents, cashFlow, cashJournal, filterCashJournal } from './cash';
import { clientName } from './client-display';
import type { ReportColumn, ReportFilters, ReportResult, StatisticsInput } from './statistics';

const day = (v = '') =>
  /^\d{2}\.\d{2}\.\d{4}$/.test(v) ? v.split('.').reverse().join('-') : v.slice(0, 10);
const col = (key: string, label: string, format?: ReportColumn['format']) => ({
  key,
  label,
  format,
});
const currency = (v: number) => money(Math.round(v) / 100);
const clubs: Record<string, string> = { central: 'Центральный', park: 'Парк', river: 'Речной' };
const sum = (rows: DemoRecord[], key: string) => rows.reduce((n, r) => n + Number(r[key] || 0), 0);
function groups(rows: DemoRecord[], key: (r: DemoRecord) => string) {
  const result = new Map<string, DemoRecord[]>();
  for (const row of rows) result.set(key(row), [...(result.get(key(row)) || []), row]);
  return result;
}
function ageAt(birth: string, end: string) {
  const d = day(birth);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(d) ||
    !Number.isFinite(Date.parse(d)) ||
    new Date(d).toISOString().slice(0, 10) !== d ||
    d > end
  )
    return null;
  const age = Number(end.slice(0, 4)) - Number(d.slice(0, 4)) - (end.slice(5) < d.slice(5) ? 1 : 0);
  return age >= 0 && age <= 120 ? age : null;
}

/** Financial report examples use recorded facts; missing payment/cost/history stays unknown. */
export function financialStatistics(
  id: string,
  f: ReportFilters,
  input: StatisticsInput,
): ReportResult | null {
  if (
    ![
      'selling_stat',
      'kassacontrol',
      'selling_clients_new',
      'clients_sell_gender_age',
      'clients_sell_discount',
      'financeresult',
      'finbyyear',
      'finbyyear_by_abonements',
    ].includes(id)
  )
    return null;
  const out: ReportResult = { metrics: [], blocks: [], notes: [] };
  const { data } = input;
  const members = input.members.filter((m) => !m.archived);
  const inClub = (club: string) =>
    f.club === 'all' || club === f.club || clubs[club] === f.club || clubs[f.club] === club;
  const inPeriod = (date: string) => day(date) >= f.from && day(date) <= f.to;
  const buyer = (s: DemoRecord) => {
    if (s.memberId) return members.find((m) => String(m.id) === s.memberId);
    const found = members.filter((m) => [m.name, clientName(m)].includes(s.client));
    return found.length === 1 ? found[0] : undefined;
  };
  const category = (s: DemoRecord) => {
    const kind = getMembershipKind(s.name, s.kindId);
    if (s.training === 'personal' || kind?.id === 'personal') return 'personal';
    if (/корп/i.test(s.category + ' ' + s.name)) return 'corporate';
    if (kind?.id === 'single' || kind?.id === 'guest') return 'single';
    if (s.category === 'Абонементы' || kind) return 'membership';
    return 'goods';
  };
  const sales: DemoRecord[] = (data.ledger || [])
    .filter(
      (s) =>
        s.category !== 'Бар' &&
        (!s.kind || s.kind === 'sale') &&
        !['Отменено', 'Отменена'].includes(s.status),
    )
    .map((s) => ({
      ...s,
      item: s.name,
      amount: String(cashCents(s.total ?? s.amount)),
      memberId: buyer(s) ? String(buyer(s)!.id) : '',
      buyer: buyer(s) ? clientName(buyer(s)!) : s.client || 'Покупатель не определён',
      saleKind: category(s),
    }));
  const selected = sales.filter((s) => inPeriod(s.date) && inClub(s.club));
  const block = (title: string, columns: ReportColumn[], rows: DemoRecord[], detail?: string) =>
    out.blocks.push({ title, columns, rows, ...(detail ? { detail } : {}) });
  const details = (key: string, name: string, rows: DemoRecord[]) => {
    block(
      `Покупатели · ${name}`,
      [col('name', 'Клиент'), col('count', 'Покупок'), col('amount', 'Сумма', 'money')],
      [...groups(rows, (r) => r.memberId || `unknown:${r.id}`)].map(([id, rr]) => ({
        id,
        name: rr[0].buyer,
        memberId: rr[0].memberId,
        count: String(rr.length),
        amount: String(sum(rr, 'amount')),
      })),
      `${key}:buyers`,
    );
    out.blocks[out.blocks.length - 1].memberLinks = true;
    block(
      `Операции · ${name}`,
      [
        col('date', 'Дата', 'date'),
        col('name', 'Клиент'),
        col('item', 'Позиция'),
        col('amount', 'Сумма', 'money'),
        col('method', 'Оплата'),
      ],
      rows.map((r) => ({ ...r, name: r.buyer })),
      `${key}:operations`,
    );
    out.blocks[out.blocks.length - 1].memberLinks = true;
  };
  if (id === 'finbyyear' || id === 'finbyyear_by_abonements') {
    const cutoff = day(input.at) < f.to ? day(input.at) : f.to;
    const list = selected.filter(
      (r) => day(r.date) <= cutoff && (id === 'finbyyear' || r.saleKind !== 'goods'),
    );
    const total = sum(list, 'amount');
    const dimension = id === 'finbyyear' ? 'month' : f.grouping;
    const rows: DemoRecord[] = [
      ...groups(list, (r) =>
        dimension === 'month'
          ? day(r.date).slice(0, 7)
          : dimension === 'club'
            ? clubs[r.club] || r.club
            : dimension === 'day'
              ? day(r.date)
              : dimension === 'category'
                ? r.planCategory || r.category || 'Без категории'
                : r.item,
      ),
    ].map(([name, rr]) => ({
      id: name,
      name,
      count: String(rr.length),
      amount: String(sum(rr, 'amount')),
      share: total ? String((sum(rr, 'amount') / total) * 100) : '',
      countShare: list.length ? String((rr.length / list.length) * 100) : '',
    }));
    if (id === 'finbyyear') {
      for (let month = f.from.slice(0, 7); month <= f.to.slice(0, 7);) {
        if (!rows.some((r) => r.id === month))
          rows.push({
            id: month,
            name: month,
            count: month > cutoff.slice(0, 7) ? '' : '0',
            amount: month > cutoff.slice(0, 7) ? '' : '0',
            share: '',
            countShare: '',
          });
        const date = new Date(month + '-01T00:00:00Z');
        date.setUTCMonth(date.getUTCMonth() + 1);
        month = date.toISOString().slice(0, 7);
      }
      rows.sort((a, b) => a.id.localeCompare(b.id));
      rows.forEach((r) => {
        r.name = new Intl.DateTimeFormat('ru', {
          month: 'long',
          year: 'numeric',
          timeZone: 'UTC',
        }).format(new Date(r.id + '-01'));
      });
    } else
      rows.sort(
        (a, b) => Number(b.amount) - Number(a.amount) || a.name.localeCompare(b.name, 'ru'),
      );
    block(
      'Распределение продаж',
      [
        col('name', id === 'finbyyear' ? 'Месяц' : 'Абонемент / группа'),
        col('count', 'Продаж'),
        col('amount', 'Сумма продаж', 'money'),
        col('share', 'Доля суммы', 'percent'),
        col('countShare', 'Доля количества', 'percent'),
      ],
      rows,
    );
    const observed = rows.filter((r) => r.amount !== '');
    out.metrics = [
      { label: 'Сумма продаж', value: currency(total) },
      { label: 'Продаж', value: list.length },
    ];
    if (id === 'finbyyear')
      out.metrics.push({
        label: 'Среднее за месяц',
        value: observed.length ? currency(total / observed.length) : '—',
      });
    if (f.compare === 'previous') {
      const days = Math.round((Date.parse(f.to) - Date.parse(f.from)) / 86400000) + 1;
      const before = new Date(Date.parse(f.from) - 86400000).toISOString().slice(0, 10);
      const start = new Date(Date.parse(f.from) - days * 86400000).toISOString().slice(0, 10);
      const prior = sales.filter(
        (r) =>
          inClub(r.club) &&
          day(r.date) >= start &&
          day(r.date) <= before &&
          (id === 'finbyyear' || r.saleKind !== 'goods'),
      );
      const amount = sum(prior, 'amount');
      out.metrics.push({
        label: 'Предыдущий период',
        value: currency(amount),
        note: amount
          ? `${Math.round((total / amount - 1) * 100)}%`
          : 'При нулевой базе процент не рассчитывается',
      });
    }
    out.notes.push(
      'Стоимость сохранённых продаж, включая подарочную оплату и кредит, без бара, внесений и отменённых операций. Возвраты не распределяются по тарифам без связи с исходной сделкой. Это не бухгалтерская прибыль.',
    );
    out.notes.push(
      id === 'finbyyear'
        ? 'Среднее считается по месяцам до даты наблюдения включительно. Месяцы без сохранённых продаж учитываются как 0, будущие — прочерком и не входят в среднее. Неполный текущий месяц не пересчитывается до полного. Демоистория неполная.'
        : 'Сумма и количество имеют разные знаменатели долей. По умолчанию показаны названия карт; объединение по категории использует только сохранённое поле категории, без угадывания по названию.',
    );
  } else if (id === 'selling_stat') {
    const included = selected.filter(
      (s) =>
        ({
          personal: f.includePersonal,
          single: f.includeSingle,
          corporate: f.includeCorporate,
          membership: f.includeMemberships,
          goods: f.includeGoods,
        })[s.saleKind] !== '0',
    );
    const events = new Map(cashJournal(data.ledger || [], []).map((e) => [e.id, e]));
    const total = sum(included, 'amount');
    const rows = [
      ...groups(included, (s) =>
        f.grouping === 'day'
          ? day(s.date)
          : f.grouping === 'club'
            ? clubs[s.club] || s.club || 'Клуб не указан'
            : f.grouping === 'category'
              ? s.category || 'Без категории'
              : s.item,
      ),
    ]
      .map(([name, rr], index) => {
        const row: DemoRecord = {
          id: String(index),
          name,
          count: String(rr.length),
          amount: String(sum(rr, 'amount')),
          share: total ? String((sum(rr, 'amount') / total) * 100) : '0',
          detailKey: `sales:${index}`,
        };
        const values = rr.map((r) => {
          const e = events.get(r.id);
          const account = cashCents(
            r.accountAmount || (r.method === 'Лицевой счёт' ? String(Number(r.amount) / 100) : '0'),
          );
          const corporate = cashCents(
            r.corporateAmount ||
              (r.method === 'Корпоративная' ? String(Number(r.amount) / 100) : '0'),
          );
          return {
            cash: e?.cash || 0,
            card: e?.card || 0,
            gift: e?.gift || 0,
            corporate,
            website: e?.website || 0,
            account,
            credit: e?.credit || 0,
          };
        });
        for (const k of [
          'cash',
          'card',
          'gift',
          'corporate',
          'website',
          'account',
          'credit',
        ] as const)
          row[k] = String(values.reduce((n, v) => n + v[k], 0));
        row.other = String(
          Math.max(
            0,
            Number(row.amount) -
              ['cash', 'card', 'gift', 'corporate', 'website', 'account', 'credit'].reduce(
                (n, k) => n + Number(row[k]),
                0,
              ),
          ),
        );
        details(row.detailKey, name, rr);
        return row;
      })
      .sort(
        (a, b) =>
          Number(b[f.salesSort === 'amount' ? 'amount' : 'count']) -
            Number(a[f.salesSort === 'amount' ? 'amount' : 'count']) ||
          a.name.localeCompare(b.name, 'ru'),
      );
    out.blocks.unshift({
      title: 'Распределение продаж',
      columns: [
        col('name', 'Позиция'),
        col('amount', 'Сумма продаж', 'money'),
        col('count', 'Продаж'),
        ...[
          ['cash', 'Наличные'],
          ['card', 'Карта'],
          ['gift', 'Подарочная'],
          ['corporate', 'Корпоративная'],
          ['website', 'Сайт'],
          ['account', 'Лицевой счёт'],
          ['credit', 'В кредит'],
          ['other', 'Не распределено'],
        ].map(([k, l]) => col(k, l, 'money')),
        col('buyers', 'Покупатели'),
        col('operations', 'Операции'),
      ],
      rows,
    });
    out.metrics = [
      { label: 'Продаж', value: included.length },
      { label: 'Сумма продаж', value: currency(total) },
      {
        label: 'Средняя покупка',
        value: included.length ? currency(total / included.length) : '—',
        note: included.length
          ? 'Сумма / количество продаж'
          : 'При отсутствии покупок не рассчитывается',
      },
    ];
    out.notes.push(
      'Количество — число операций продажи. Возвраты и бар исключены. Неизвестный способ оплаты показан отдельно; оплаты с лицевого счёта и подарочной карты не считаются новыми поступлениями в кассу.',
    );
  } else if (id === 'kassacontrol') {
    const entries = filterCashJournal(
      cashJournal(
        (data.ledger || []).filter((r) => !['Отменено', 'Отменена'].includes(r.status)),
        data['cash-events'] || [],
      ).filter((e) => inPeriod(e.date) && inClub(e.club)),
      '',
      'all',
      f.payment,
    );
    const rows = entries.map((e) => {
      const flow = cashFlow(e);
      return {
        id: e.id,
        name: e.id,
        date: `${e.date} ${e.time}`,
        income: String(flow.income),
        expense: String(flow.expense),
        method: e.method,
        register: '№1',
        comment: e.comment || e.name,
        cashier: e.cashier,
        club: clubs[e.club] || e.club,
      };
    });
    block(
      'Журнал кассы · №1',
      [
        col('name', 'Операция'),
        col('date', 'Дата и время'),
        col('income', 'Приход', 'money'),
        col('expense', 'Расход', 'money'),
        col('method', 'Оплата'),
        col('register', 'Касса'),
        col('comment', 'Комментарий'),
        col('cashier', 'Кассир'),
        col('club', 'Клуб'),
      ],
      rows,
    );
    const income = sum(rows, 'income'),
      expense = sum(rows, 'expense');
    out.metrics = [
      { label: 'Приход', value: currency(income) },
      { label: 'Расход', value: currency(expense) },
      { label: 'Изменение за период', value: currency(income - expense) },
    ];
    out.notes.push(
      'Одна касса №1. Показаны продажи, внесения, снятия и возвраты. Разность прихода и расхода — движение за период, не остаток: входящий остаток не известен. Подарочные карты и лицевой счёт не создают повторного денежного прихода.',
    );
  } else if (id === 'selling_clients_new') {
    const first = members.flatMap((m) => {
      const eligible = sales
        .filter(
          (s) =>
            s.memberId === String(m.id) &&
            s.saleKind !== 'goods' &&
            (f.includePersonal !== '0' || s.saleKind !== 'personal') &&
            (f.includeSingle !== '0' || s.saleKind !== 'single'),
        )
        .sort((a, b) =>
          `${day(a.date)}${a.time || ''}${a.id}`.localeCompare(
            `${day(b.date)}${b.time || ''}${b.id}`,
          ),
        );
      const s = eligible[0];
      const profile = getClientProfile(m, data);
      const criterion =
        f.criterion === 'purchase'
          ? s?.date
          : f.criterion === 'visit'
            ? input.visits
                .filter((v) => v.memberId === m.id)
                .map((v) => day(v.enteredAt))
                .sort()[0]
            : m.joined;
      // An earlier recorded subscription invalidates a purported first purchase in a partial ledger.
      const earlierPass = profile.subscriptions.some((p) => day(p.boughtAt) < day(s?.date));
      return s &&
        criterion &&
        inPeriod(criterion) &&
        inPeriod(s.date) &&
        inClub(s.club) &&
        !earlierPass
        ? [s]
        : [];
    });
    const rows = [...groups(first, (s) => s.item)].map(([name, rr], i) => {
      const known = rr.every((r) => r.basePrice !== undefined);
      const nominal = known ? rr.reduce((n, r) => n + cashCents(r.basePrice), 0) : null;
      details(`new:${i}`, name, rr);
      return {
        id: String(i),
        name,
        count: String(rr.length),
        price:
          known && new Set(rr.map((r) => cashCents(r.basePrice))).size === 1
            ? String(cashCents(rr[0].basePrice))
            : '',
        nominal: nominal === null ? '' : String(nominal),
        amount: String(sum(rr, 'amount')),
        detailKey: `new:${i}`,
      };
    });
    out.blocks.unshift({
      title: 'Первые абонементы новых клиентов',
      columns: [
        col('name', 'Абонемент'),
        col('count', 'Клиентов'),
        col('price', 'Цена по прайсу', 'money'),
        col('nominal', 'Стоимость до скидки', 'money'),
        col('amount', 'Выручка', 'money'),
        col('buyers', 'Покупатели'),
      ],
      rows,
    });
    out.metrics = [
      { label: 'Новых покупателей', value: first.length },
      { label: 'Выручка', value: currency(sum(first, 'amount')) },
    ];
    out.notes.push(
      'Один первый подходящий абонемент на клиента. Критерий нового клиента и покупка должны попадать в период. История демобазы неполная: отсутствие более ранней покупки не доказывает новизну в реальной системе. Если прайс не сохранён или менялся, единая цена показана прочерком.',
    );
  } else if (id === 'clients_sell_discount') {
    const known = selected.filter(
      (s) => s.basePrice !== undefined && s.discountAmount !== undefined,
    );
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
      known.map((s) => ({
        ...s,
        name: s.buyer,
        original: String(cashCents(s.basePrice)),
        discount: String(cashCents(s.discountAmount)),
      })),
    );
    out.blocks[0].memberLinks = true;
    const rows = [
      ...groups(selected, (s) =>
        s.basePrice === undefined || s.discountAmount === undefined
          ? 'Скидка не известна'
          : cashCents(s.discountAmount) === 0
            ? 'Без скидки'
            : s.discountName || 'Скидка без названия',
      ),
    ].map(([name, rr], i) => {
      details(`discount:${i}`, name, rr);
      return {
        id: String(i),
        name,
        count: String(rr.length),
        amount: String(sum(rr, 'amount')),
        detailKey: `discount:${i}`,
      };
    });
    block(
      'Продажи по скидкам',
      [
        col('name', 'Скидка'),
        col('count', 'Операций'),
        col('amount', 'Сумма продаж', 'money'),
        col('buyers', 'Покупатели'),
      ],
      rows,
    );
    out.metrics = [
      { label: 'Со скидкой', value: known.filter((s) => cashCents(s.discountAmount) > 0).length },
      {
        label: 'Сумма известных скидок',
        value: currency(known.reduce((n, s) => n + cashCents(s.discountAmount), 0)),
      },
      { label: 'Скидка не известна', value: selected.length - known.length },
    ];
    out.notes.push(
      'Сумма — оплаченная стоимость, не размер скидки. Продажи без исходной цены/сведений о скидке не считаются продажами без скидки.',
    );
  } else if (id === 'clients_sell_gender_age') {
    const rows = new Map<string, DemoRecord>();
    let unknown = 0;
    for (const s of selected.filter((s) => f.onlyPersonal !== '1' || s.saleKind === 'personal')) {
      const m = buyer(s),
        p = m && getClientProfile(m, data),
        age = p ? ageAt(p.birthDate, f.to) : null;
      const gender =
        p?.gender === 'Мужской' ? 'male' : p?.gender === 'Женский' ? 'female' : 'unknown';
      const key = age === null ? 'Возраст не известен' : String(age);
      const row = rows.get(key) || {
        id: key,
        name: age === null ? key : `${age} лет`,
        male: '0',
        female: '0',
        unknown: '0',
        maleCount: '0',
        femaleCount: '0',
        unknownCount: '0',
      };
      row[gender] = String(Number(row[gender]) + Number(s.amount));
      row[`${gender}Count`] = String(Number(row[`${gender}Count`]) + 1);
      rows.set(key, row);
      if (age === null || gender === 'unknown') unknown += Number(s.amount);
    }
    const rr = [...rows.values()].sort((a, b) => Number(a.id) - Number(b.id));
    const columns = [
      col('name', 'Возраст на конец периода'),
      col('male', 'Мужчины', 'money'),
      col('female', 'Женщины', 'money'),
      col('unknown', 'Пол не известен', 'money'),
    ];
    block('Сумма покупок по полу и возрасту', columns, rr);
    block(
      'Средний чек по полу и возрасту',
      columns,
      rr.map((r) => ({
        ...r,
        ...Object.fromEntries(
          ['male', 'female', 'unknown'].map((k) => [
            k,
            Number(r[`${k}Count`]) ? String(Math.round(Number(r[k]) / Number(r[`${k}Count`]))) : '',
          ]),
        ),
      })),
    );
    block(
      'Количество покупок по полу и возрасту',
      columns.map((c) => (c.key === 'name' ? c : { key: c.key, label: c.label })),
      rr.map((r) => ({ ...r, male: r.maleCount, female: r.femaleCount, unknown: r.unknownCount })),
    );
    out.metrics = [
      {
        label: 'Сумма продаж',
        value: currency(
          rr.reduce((n, r) => n + Number(r.male) + Number(r.female) + Number(r.unknown), 0),
        ),
      },
      { label: 'Без полного пола/возраста', value: currency(unknown) },
    ];
    out.notes.push(
      'Зеркальная диаграмма показывает суммы покупок; средний чек — сумма / число операций. Возраст рассчитан на конец периода. Некорректные даты и возраст старше 120 лет отнесены к неизвестным. Неизвестные сведения не исключаются из итога.',
    );
  } else {
    const clubKeys =
      f.club === 'all' ? ['Центральный', 'Парк', 'Речной'] : [clubs[f.club] || f.club];
    const clubId = (name: string) => Object.entries(clubs).find(([, n]) => n === name)?.[0] || name;
    const revenue = (data['finance-revenue'] || []).filter(
      (r) => inPeriod(r.date) && inClub(r.club),
    );
    const costs = (data['trainer-costs'] || []).filter((r) => inPeriod(r.date) && inClub(r.club));
    const rows: DemoRecord[] = [];
    for (const [kind, label] of [
      ['group', 'Групповые программы'],
      ['personal', 'Персональные тренировки'],
      ['gym', 'Тренажёрный зал'],
      ['gift', 'Подарочные карты'],
      ['goods', 'Товары'],
      ['freeze', 'Заморозка абонемента'],
      ['inbody', 'INBODY'],
    ]) {
      const rr = revenue.filter((r) => r.kind === kind);
      const cc = costs.filter((r) => r.kind === (kind === 'gym' ? 'duty' : kind));
      const make = (type: string, prefix: string) => {
        const row: DemoRecord = {
          id: `${kind}:${type}`,
          name: `${prefix} · ${label}`,
          rowKind: type,
        };
        for (const name of clubKeys) {
          const r = rr.filter((v) => v.club === clubId(name) || v.club === name),
            c = cc.filter((v) => v.club === clubId(name) || v.club === name);
          const rev = r.reduce((n, v) => n + cashCents(v.amount), 0),
            cost = c.reduce((n, v) => n + cashCents(v.amount), 0);
          row[name] =
            type === 'revenue'
              ? r.length
                ? String(rev)
                : ''
              : type === 'cost'
                ? c.length
                  ? String(cost)
                  : ''
                : r.length && c.length
                  ? String(rev - cost)
                  : '';
        }
        row.total = clubKeys.every((k) => row[k] !== '')
          ? String(clubKeys.reduce((n, k) => n + Number(row[k]), 0))
          : '';
        row.visits =
          type === 'revenue' && rr.length && rr.every((r) => r.visits !== undefined)
            ? String(rr.reduce((n, r) => n + Number(r.visits), 0))
            : '';
        const knownRevenue = rr.reduce((n, r) => n + cashCents(r.amount), 0);
        row.average =
          Number(row.visits) > 0 ? String(Math.round(knownRevenue / Number(row.visits))) : '';
        return row;
      };
      rows.push(make('revenue', 'Выручка'));
      if (['group', 'personal', 'gym'].includes(kind))
        rows.push(make('cost', 'Оплата тренерам'), make('profit', 'Промежуточный результат'));
    }
    block(
      'Промежуточный финансовый результат',
      [
        col('name', 'Показатель'),
        ...clubKeys.map((k) => col(k, k, 'money')),
        col('total', 'Всего по выбранным клубам', 'money'),
        col('visits', 'Посещений / продаж'),
        col('average', 'Средняя цена', 'money'),
      ],
      rows,
    );
    out.metrics = [
      {
        label: 'Период',
        value: new Intl.DateTimeFormat('ru', {
          month: 'long',
          year: 'numeric',
          timeZone: 'UTC',
        }).format(new Date(f.from)),
      },
    ];
    out.notes.push(
      'Результат по направлению = признанная выручка − записанная оплата тренерам. Это промежуточный результат без аренды, налогов и остальных расходов. Источник выручки — отдельные начисления, не сумма всех кассовых поступлений. Продажа подарочной карты учитывается отдельно, погашение повторно сюда не добавляется. Прочерк — нет подтверждённых данных; ноль показывается только при явной нулевой записи.',
    );
  }
  return out;
}
