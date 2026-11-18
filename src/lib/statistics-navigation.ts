import type { ReportFilters } from './statistics';
import { reportMonth } from './report-period';

export const reportHasClub = (id: string) =>
  ![
    'birdthday',
    'clients_new',
    'newclients',
    'newclients_source',
    'clients_active',
    'report_all_clients_phones',
    'clients_gender_age',
    'fincredits',
    'clients_segmetation',
  ].includes(id);
export const reportHasTrainer = (id: string) =>
  id.startsWith('report_pclients') ||
  [
    'gtrener_busy',
    'ptrener_rating',
    'ptrener_rating_all',
    'gtrener_rating',
    'free_trener_find',
    'gt_finance',
    'trener_financial_result',
  ].includes(id);

export function reportPeriodMode(id: string) {
  if (id === 'trener_financial_result') return 'year-to-month';
  if (['visit_by_period', 'financeresult'].includes(id)) return 'month';
  if (id === 'gtrener_busy') return 'week';
  if (
    [
      'clients_active',
      'client_never',
      'client_lastvisit',
      'client_lastvisit_personal',
      'free_trener_find',
      'clients_segmetation',
    ].includes(id)
  )
    return 'snapshot';
  if (
    [
      'clients_ltv',
      'selling_clients_secondary_summer',
      'client_lifetime',
      'birdthday',
      'fincredits',
      'report_all_clients_phones',
    ].includes(id)
  )
    return 'history';
  return 'range';
}

/** Share context without treating a full history, a snapshot and a month as one period. */
export function transferReportFilters(
  fromId: string,
  toId: string,
  current: ReportFilters,
  next: ReportFilters,
): ReportFilters {
  const fromMode = reportPeriodMode(fromId),
    toMode = reportPeriodMode(toId);
  let range = { from: next.from, to: next.to };
  if (fromMode === toMode) range = { from: current.from, to: current.to };
  else if (toMode === 'month' || toMode === 'year-to-month') {
    range = reportMonth(current.to.slice(0, 7)) || range;
    if (toMode === 'year-to-month') range.from = range.to.slice(0, 4) + '-01-01';
  } else if (toMode === 'snapshot' || toMode === 'week')
    range = { from: current.to, to: current.to };
  else if (toMode === 'history') range = { from: '1900-01-01', to: current.to };
  const newClientIds = ['clients_new', 'newclients', 'newclients_source'];
  const sourceClub =
    fromId === 'clients_gender_age'
      ? current.clubs.split(',').filter(Boolean).length === 1
        ? current.clubs
        : 'all'
      : current.club;
  return {
    ...next,
    ...range,
    club: reportHasClub(toId) ? sourceClub : 'all',
    trainer: reportHasTrainer(toId) ? current.trainer : 'all',
    ...(toId === 'clients_gender_age'
      ? { clubs: sourceClub === 'all' ? next.clubs : sourceClub }
      : {}),
    ...(newClientIds.includes(fromId) && newClientIds.includes(toId)
      ? {
          criterion: current.criterion,
          source: current.source,
          onlyOnline: current.onlyOnline,
          onlyNoPurchase: current.onlyNoPurchase,
        }
      : {}),
    ...(['clients_rating', 'clients_rating_visit', 'notcame'].includes(toId)
      ? { threshold: current.threshold }
      : {}),
  };
}
