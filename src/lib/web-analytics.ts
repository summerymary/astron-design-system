export type WebSource = { id: string; name: string; tone: 0 | 1 | 2 | 3 };
export const webSources: WebSource[] = [
  { id: 'search', name: 'Поисковые системы', tone: 0 },
  { id: 'direct', name: 'Прямые заходы', tone: 1 },
  { id: 'ads', name: 'Реклама', tone: 2 },
  { id: 'social', name: 'Социальные сети', tone: 3 },
];
export const webMaterials = [
  { id: 'first', name: 'Первый раз в клубе: с чего начать', path: '/journal/first-visit' },
  { id: 'card', name: 'Как выбрать клубную карту', path: '/journal/club-card' },
  { id: 'personal', name: 'Что даёт занятие с тренером', path: '/journal/personal-training' },
  { id: 'group', name: 'Групповые занятия: выбираем направление', path: '/journal/group-classes' },
  { id: 'recovery', name: 'Восстановление после тренировки', path: '/journal/recovery' },
  { id: 'bag', name: 'Что взять с собой на тренировку', path: '/journal/training-bag' },
];
export const webOffers = [
  { id: 'iron', name: 'Железная карта', category: 'Абонементы', group: 'Клубные карты' },
  { id: 'light', name: 'Лайт', category: 'Абонементы', group: 'Клубные карты' },
  { id: 'single', name: 'Разовое посещение', category: 'Абонементы', group: 'Разовые визиты' },
  { id: 'guest', name: 'Гостевой визит', category: 'Абонементы', group: 'Разовые визиты' },
  { id: 'pt-one', name: 'Персональная тренировка', category: 'Тренировки', group: 'Персональные' },
  {
    id: 'pt-four',
    name: 'Пакет из четырёх тренировок',
    category: 'Тренировки',
    group: 'Персональные',
  },
  { id: 'yoga', name: 'Йога', category: 'Тренировки', group: 'Групповые' },
  { id: 'pilates', name: 'Пилатес', category: 'Тренировки', group: 'Групповые' },
  { id: 'socks', name: 'Носки для тренировок', category: 'Товары', group: 'Аксессуары' },
  { id: 'bands', name: 'Резинки для волос', category: 'Товары', group: 'Аксессуары' },
  { id: 'water', name: 'Вода', category: 'Товары', group: 'Напитки' },
];
export type WebVisit = {
  id: string;
  day: string;
  visitor: string;
  source: string;
  device: 'desktop' | 'mobile';
  robot: boolean;
  pages: {
    material: string;
    seconds: number | null;
    read: boolean | null;
    scroll: boolean | null;
    next: boolean | null;
  }[];
  offers: { offer: string; views: number; cart: number; purchases: number }[];
};
export type WebSample = { from: string; to: string; visits: WebVisit[] };
export type WebFilters = {
  from: string;
  to: string;
  source: string;
  device: string;
  robots: boolean;
};
export type WebView = 'sources' | 'materials' | 'offers';
const dayMs = 86400000;
export function shiftWebDay(day: string, offset: number) {
  return new Date(Date.parse(day + 'T00:00:00Z') + offset * dayMs).toISOString().slice(0, 10);
}
const validDay = (day: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(day) &&
  Number.isFinite(Date.parse(day + 'T00:00:00Z')) &&
  new Date(day + 'T00:00:00Z').toISOString().slice(0, 10) === day;
export function webFilterError(f: WebFilters) {
  if (!validDay(f.from) || !validDay(f.to)) return 'Укажите начало и конец периода.';
  if (f.from > f.to) return 'Начало периода должно быть не позже окончания.';
  if ((Date.parse(f.to) - Date.parse(f.from)) / dayMs > 365)
    return 'Выберите период не длиннее 366 дней.';
  return null;
}
/** Synthetic sessions only. No counter IDs, personal data or network requests. */
export function createWebSample(to: string): WebSample {
  const visits: WebVisit[] = [];
  const from = shiftWebDay(to, -59);
  for (let d = 0; d < 60; d++)
    for (let s = 0; s < webSources.length; s++) {
      const count = 4 + ((d * 7 + s * 11) % 13);
      for (let i = 0; i < count; i++) {
        const n = d * 131 + s * 37 + i;
        const pageCount = n % 4 === 0 ? 2 : 1;
        const offerCount = n % 3 === 0 ? 2 : n % 5 === 0 ? 0 : 1;
        visits.push({
          id: `web-${d}-${s}-${i}`,
          day: shiftWebDay(from, d),
          visitor: `visitor-${(d * 17 + s * 29 + Math.floor(i / 2) * 7) % 230}`,
          source: webSources[s].id,
          device: n % 3 === 0 ? 'desktop' : 'mobile',
          robot: n % 17 === 0,
          pages: Array.from({ length: pageCount }, (_, j) => ({
            material: webMaterials[(n + j) % webMaterials.length].id,
            seconds: (n + j) % 19 === 0 ? null : 15 + ((n * 3 + j * 7) % 210),
            read: (n + j) % 13 === 0 ? null : (n + j) % 5 < 3,
            scroll: (n + j) % 11 === 0 ? null : (n + j) % 4 !== 0,
            next: (n + j) % 23 === 0 ? null : j === 0 && pageCount > 1,
          })),
          offers: Array.from({ length: offerCount }, (_, j) => {
            const purchases = (n + j * 3) % 13 === 0 ? 1 : 0;
            return {
              offer: webOffers[(n + j) % webOffers.length].id,
              views: 1 + ((n + j) % 3),
              cart: purchases || ((n + j) % 4 === 0 ? 1 : 0),
              purchases,
            };
          }),
        });
      }
    }
  return { from, to, visits };
}
export function webScope(sample: WebSample, f: WebFilters) {
  const error = webFilterError(f);
  const coveredFrom = f.from > sample.from ? f.from : sample.from;
  const coveredTo = f.to < sample.to ? f.to : sample.to;
  const covered = !error && coveredFrom <= coveredTo;
  const visits = covered
    ? sample.visits.filter(
        (v) =>
          v.day >= f.from &&
          v.day <= f.to &&
          (f.source === 'all' || v.source === f.source) &&
          (f.device === 'all' || v.device === f.device) &&
          (f.robots || !v.robot),
      )
    : [];
  return {
    error,
    covered,
    partial: covered && (coveredFrom !== f.from || coveredTo !== f.to),
    from: coveredFrom,
    to: coveredTo,
    visits,
  };
}
const norm = (text: string) => text.toLocaleLowerCase('ru').replace(/ё/g, 'е');
export const webMatches = (text: string, query: string) =>
  norm(query)
    .trim()
    .split(/\s+/)
    .every((word) => norm(text).includes(word));
export const webPercent = (part: number, all: number) => (all > 0 ? (part * 100) / all : null);
export function webVisitMetrics(visits: WebVisit[]) {
  const buyers = visits.filter((v) => v.offers.some((o) => o.purchases > 0)).length;
  return {
    visits: visits.length,
    visitors: new Set(visits.map((v) => v.visitor)).size,
    views: visits.reduce(
      (sum, v) => sum + v.pages.length + v.offers.reduce((n, o) => n + o.views, 0),
      0,
    ),
    buyers,
    conversion: webPercent(buyers, visits.length),
  };
}
export function webSourceRows(visits: WebVisit[], query = '') {
  return webSources
    .filter((s) => webMatches(s.name, query))
    .map((source) => ({
      ...source,
      ...webVisitMetrics(visits.filter((v) => v.source === source.id)),
    }));
}
export function webDays(from: string, to: string) {
  const days: string[] = [];
  for (let day = from; day <= to; day = shiftWebDay(day, 1)) days.push(day);
  return days;
}
export function webSourceTrend(
  visits: WebVisit[],
  days: string[],
  sourceIds: string[],
  metric: 'visits' | 'visitors',
) {
  return days.map((day) => ({
    id: day,
    name: day.split('-').reverse().join('.'),
    values: sourceIds.map(
      (source) =>
        webVisitMetrics(visits.filter((v) => v.day === day && v.source === source))[metric],
    ),
  }));
}
export function webMaterialMetrics(visits: WebVisit[], ids: string[]) {
  const pages = visits.flatMap((v) => v.pages.filter((p) => ids.includes(p.material)));
  const timed = pages.filter((p) => p.seconds !== null);
  const observed = (key: 'read' | 'scroll' | 'next') => {
    const known = pages.filter((p) => p[key] !== null);
    return {
      value: webPercent(known.filter((p) => p[key]).length, known.length),
      known: known.length,
    };
  };
  return {
    views: pages.length,
    visitors: new Set(
      visits.filter((v) => v.pages.some((p) => ids.includes(p.material))).map((v) => v.visitor),
    ).size,
    seconds: timed.length ? timed.reduce((n, p) => n + p.seconds!, 0) / timed.length : null,
    timed: timed.length,
    read: observed('read'),
    scroll: observed('scroll'),
    next: observed('next'),
  };
}
export function webMaterialRows(visits: WebVisit[], query = '') {
  return webMaterials
    .filter((m) => webMatches(m.name + ' ' + m.path, query))
    .map((m) => ({ ...m, ...webMaterialMetrics(visits, [m.id]) }));
}
export type WebTreeRow = {
  id: string;
  name: string;
  values: Record<string, number | null>;
  children?: WebTreeRow[];
};
export function webOfferMetrics(visits: WebVisit[], ids: string[]) {
  const relevant = visits.filter((v) => v.offers.some((o) => ids.includes(o.offer) && o.views > 0));
  const events = visits.flatMap((v) => v.offers.filter((o) => ids.includes(o.offer)));
  return {
    visits: relevant.length,
    visitors: new Set(relevant.map((v) => v.visitor)).size,
    views: events.reduce((n, o) => n + o.views, 0),
    cart: events.reduce((n, o) => n + o.cart, 0),
    purchases: events.reduce((n, o) => n + o.purchases, 0),
  };
}
export function webOfferTree(visits: WebVisit[], query = '') {
  const offers = webOffers.filter((o) => webMatches(`${o.category} ${o.group} ${o.name}`, query));
  const nodes: WebTreeRow[] = [...new Set(offers.map((o) => o.category))].map((category) => {
    const children = offers.filter((o) => o.category === category);
    return {
      id: `category:${category}`,
      name: category,
      values: webOfferMetrics(
        visits,
        children.map((o) => o.id),
      ),
      children: [...new Set(children.map((o) => o.group))].map((group) => {
        const rows = children.filter((o) => o.group === group);
        return {
          id: `group:${category}:${group}`,
          name: group,
          values: webOfferMetrics(
            visits,
            rows.map((o) => o.id),
          ),
          children: rows.map((o) => ({
            id: o.id,
            name: o.name,
            values: webOfferMetrics(visits, [o.id]),
          })),
        };
      }),
    };
  });
  return {
    nodes,
    ids: offers.map((o) => o.id),
    total: webOfferMetrics(
      visits,
      offers.map((o) => o.id),
    ),
  };
}
export function webCsv(headers: string[], rows: (string | number | null)[][]) {
  const cell = (v: string | number | null) => '"' + String(v ?? '—').replace(/"/g, '""') + '"';
  return '\uFEFF' + [headers, ...rows].map((row) => row.map(cell).join(';')).join('\r\n');
}
