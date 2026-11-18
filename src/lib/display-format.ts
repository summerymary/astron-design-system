/** Domain values stay numeric; localization belongs at the display boundary. */
export const decimal = (value: number, digits = 1) =>
  Number.isFinite(value) ? value.toLocaleString('ru-RU', { maximumFractionDigits: digits }) : '—';

export function displayNumber(value: string | number): string {
  return typeof value === 'number'
    ? decimal(value, 2)
    : /^-?\d+\.\d+$/.test(value)
      ? decimal(Number(value), 2)
      : value;
}

export const displayDuration = (value: string) =>
  /^\d+$/.test(value || '')
    ? `${Math.floor(Number(value) / 60)} мин ${Number(value) % 60} с`
    : value || '—';
