/** Series identity never depends on which zero-valued categories happen to be visible. */
export function chartTone(id: string): number {
  if (['Продлил', 'converted', '1'].includes(id)) return 0;
  if (['Не продлил', 'lost', '2'].includes(id)) return 1;
  if (['Окно ещё открыто', 'open', '3'].includes(id)) return 2;
  return [...id].reduce((n, char) => (n * 31 + char.charCodeAt(0)) >>> 0, 0) % 4;
}

export function chartValueState(values: (number | null)[]) {
  const known = values.filter((value): value is number => value !== null && Number.isFinite(value));
  return !known.length ? 'unknown' : known.every((value) => value === 0) ? 'zero' : 'known';
}

/** Daily observations must not be collapsed into identical month labels. */
export function chartCategory(name: string, id: string, kind: string, includeYear = false) {
  if (kind === 'lines' && /^\d{4}-\d{2}-\d{2}$/.test(id)) return id.slice(8);
  if (/^\d{4}-\d{2}$/.test(id))
    return new Intl.DateTimeFormat('ru', {
      month: 'short',
      year: includeYear ? '2-digit' : undefined,
      timeZone: 'UTC',
    }).format(new Date(id + '-01'));
  return kind === 'lines' && /^\d{2}\./.test(name) ? name.slice(0, 2) : name;
}

export function chartScale(maximum: number, fixed?: number) {
  if (fixed && fixed > 0) return { maximum: fixed, ticks: [0, fixed / 2, fixed] };
  const target = Math.max(1, maximum) / 4;
  const power = 10 ** Math.floor(Math.log10(target));
  const step = Math.max(1, ([1, 2, 5, 10].find((n) => n * power >= target) || 10) * power);
  const limit = Math.ceil(Math.max(1, maximum) / step) * step;
  return {
    maximum: limit,
    ticks: Array.from({ length: Math.round(limit / step) + 1 }, (_, i) => i * step),
  };
}
