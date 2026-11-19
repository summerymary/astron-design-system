import { Children, Fragment, isValidElement } from 'react';
import type { ReactNode } from 'react';
import { ReportMonthPicker } from './ReportMonthPicker';
import { ReportWeekPicker } from './ReportWeekPicker';

function flatten(children: ReactNode): ReactNode[] {
  return Children.toArray(children).flatMap((child) =>
    isValidElement<{ children?: ReactNode }>(child) && child.type === Fragment
      ? flatten(child.props.children)
      : [child],
  );
}
export function ReportFilterBar({
  children,
  activeCount = 0,
  label = 'Дополнительные фильтры',
}: {
  children: ReactNode;
  activeCount?: number;
  label?: string;
}) {
  const items = flatten(children);
  const isMain = (child: ReactNode) =>
    isValidElement<{ 'data-filter'?: string }>(child) &&
    (child.type === ReportMonthPicker ||
      child.type === ReportWeekPicker ||
      [
        'from',
        'to',
        'club',
        'trainer',
        'kind',
        'criterion',
        'threshold',
        'plan',
        'grouping',
      ].includes(child.props['data-filter'] || ''));
  const main = items.filter(isMain),
    extra = items.filter((child) => !isMain(child));
  return (
    <div className="ws-toolbar statistics-filter-bar" data-ui="report-filter-bar">
      {!!main.length && <div className="statistics-filters-main">{main}</div>}
      {!!extra.length && (
        <details className="statistics-filter-disclosure">
          <summary>
            {label}
            {activeCount ? ` · изменено ${activeCount}` : ''}
          </summary>
          <div className="statistics-filters-extra">{extra}</div>
        </details>
      )}
    </div>
  );
}
