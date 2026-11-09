import { TODAY } from '../data/workspace';
export const DEMO_DAY = TODAY;
const origin = Date.parse(`${DEMO_DAY}T14:35:00+03:00`);
let tick = 0;

export const demoNow = () => new Date(origin);
export const nextDemoNow = () => new Date(origin + tick++ * 60_000);
export const resetDemoClock = () => {
  tick = 0;
};
export function demoStamp(date: Date) {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
    .format(date)
    .replace(' ', 'T');
}
export function daysInClub(joined: string) {
  const [day, month, year] = joined.split('.').map(Number);
  const start = Date.UTC(year, month - 1, day);
  const end = Date.parse(`${DEMO_DAY}T00:00:00Z`);
  return Number.isFinite(start) ? Math.max(0, Math.floor((end - start) / 86_400_000)) : 0;
}
