import { useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, ArrowUpRight } from 'lucide-react';
import type { ReportTreeNode, ReportTreeSort } from '../lib/report-tree';
import { sortReportTree, flattenReportTree } from '../lib/report-tree';
import { Empty } from './WorkspaceUI';

export type ReportTreeColumn = {
  key: string;
  label: string;
  format?: (value: number | null) => string;
};
export function ReportTreeTable({
  nodes,
  columns,
  sort,
  onSort,
  total,
  label,
  nameLabel = 'Название',
  onOpen,
  openLabel = 'Подробнее',
  initiallyExpanded = false,
}: {
  nodes: ReportTreeNode[];
  columns: ReportTreeColumn[];
  sort: ReportTreeSort;
  onSort: (sort: ReportTreeSort) => void;
  total?: ReportTreeNode;
  label: string;
  nameLabel?: string;
  onOpen?: (node: ReportTreeNode) => void;
  openLabel?: string;
  initiallyExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(
    () =>
      new Set(
        initiallyExpanded
          ? flattenReportTree(nodes)
              .filter((r) => r.node.children?.length)
              .map((r) => r.node.id)
          : [],
      ),
  );
  const ordered = sortReportTree(nodes, sort);
  const changeSort = (key: string) =>
    onSort({ key, asc: sort.key === key ? !sort.asc : key === 'name' });
  const header = (key: string, text: string) => (
    <th
      key={key}
      scope="col"
      aria-sort={sort.key === key ? (sort.asc ? 'ascending' : 'descending') : undefined}
    >
      <button type="button" onClick={() => changeSort(key)}>
        {text}
        {sort.key === key &&
          (sort.asc ? (
            <ArrowUp size={16} aria-hidden="true" />
          ) : (
            <ArrowDown size={16} aria-hidden="true" />
          ))}
      </button>
    </th>
  );
  const cells = (node: ReportTreeNode) =>
    columns.map((c) => (
      <td key={c.key}>
        {c.format
          ? c.format(node.values[c.key] ?? null)
          : ((node.values[c.key] ?? null)?.toLocaleString('ru-RU', { maximumFractionDigits: 1 }) ??
            '—')}
      </td>
    ));
  const render = (rows: ReportTreeNode[], depth = 0): ReactNode =>
    rows
      .map((node) => {
        const branch = !!node.children?.length,
          open = expanded.has(node.id);
        return (
          <tbody key={node.id}>
            <tr data-depth={depth}>
              <th scope="row">
                <div className="report-tree-name">
                  {branch ? (
                    <button
                      type="button"
                      aria-expanded={open}
                      aria-label={`${open ? 'Свернуть' : 'Развернуть'}: ${node.name}`}
                      onClick={() =>
                        setExpanded((previous) => {
                          const next = new Set(previous);
                          if (next.has(node.id)) next.delete(node.id);
                          else next.add(node.id);
                          return next;
                        })
                      }
                    >
                      {open ? (
                        <ChevronDown size={18} aria-hidden="true" />
                      ) : (
                        <ChevronRight size={18} aria-hidden="true" />
                      )}
                      <span>{node.name}</span>
                    </button>
                  ) : onOpen ? (
                    <button
                      type="button"
                      aria-label={`${openLabel}: ${node.name}`}
                      onClick={() => onOpen(node)}
                    >
                      <span>
                        {node.name}
                        {node.note && <small>{node.note}</small>}
                      </span>
                      <ArrowUpRight size={16} aria-hidden="true" />
                    </button>
                  ) : (
                    <span>{node.name}</span>
                  )}
                </div>
              </th>
              {cells(node)}
            </tr>
          </tbody>
        );
      })
      .flatMap((row, index) => {
        const node = rows[index];
        return [
          row,
          ...(node.children?.length && expanded.has(node.id)
            ? [render(node.children, depth + 1)]
            : []),
        ];
      });
  if (!nodes.length) return <Empty title="Ничего не найдено" text="Измените поиск или фильтры." />;
  return (
    <div
      className="report-tree-scroll"
      data-ui="report-tree-table"
      role="region"
      aria-label={label}
      tabIndex={0}
    >
      <table className="ws-table report-tree-table">
        <caption className="sr-only">
          {label}. Стрелки у названия раскрывают уровни; заголовки сортируют строки внутри каждого
          уровня.
        </caption>
        <thead>
          <tr>
            {header('name', nameLabel)}
            {columns.map((c) => header(c.key, c.label))}
          </tr>
        </thead>
        {render(ordered)}
        {total && (
          <tfoot>
            <tr>
              <th scope="row">{total.name}</th>
              {cells(total)}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
