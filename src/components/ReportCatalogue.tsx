import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import {
  catalogueReports,
  reportDescription,
  reportGroups,
  reportPending,
  reportTitle,
} from '../data/statistics';
import type { ReportDefinition } from '../data/statistics';
import { matchesSearch } from '../lib/directory-search';
import { Empty, SearchBox, Tabs } from './WorkspaceUI';
import '../styles/statistics.css';

export function ReportCatalogue({
  reports,
  onOpen,
}: {
  reports: ReportDefinition[];
  onOpen: (id: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState('all');
  const found = catalogueReports(reports).filter((r) =>
    matchesSearch(`${reportTitle(r)} ${r.sourceTitle} ${reportDescription(r)}`, query),
  );
  const shown = found.filter((r) => group === 'all' || r.group === group);
  return (
    <section className="panel ws-panel" data-ui="report-catalogue">
      <div className="ws-toolbar statistics-catalogue-search">
        <SearchBox
          value={query}
          onChange={setQuery}
          label="Поиск отчёта"
          placeholder="Посещения, продления, выручка, тренеры…"
        />
        <span className="ws-muted" aria-live="polite">
          Найдено: {shown.length}
        </span>
      </div>
      <Tabs
        label="Категории отчётов"
        value={group}
        onChange={setGroup}
        items={[
          { id: 'all', label: 'Все отчёты', count: found.length },
          ...reportGroups.map((g) => ({
            ...g,
            count: found.filter((r) => r.group === g.id).length,
          })),
        ]}
      />
      <div className="ws-panel-body statistics-catalogue-groups">
        {reportGroups
          .filter((g) => group === 'all' || g.id === group)
          .map((g) => {
            const rows = shown.filter((r) => r.group === g.id);
            return rows.length ? (
              <section key={g.id}>
                <h3>{g.label}</h3>
                <div className="ws-card-grid">
                  {rows.map((r) => (
                    <button
                      type="button"
                      className="panel ws-link-card"
                      key={r.id}
                      onClick={() => onOpen(r.id)}
                    >
                      <span>
                        <strong>{reportTitle(r)}</strong>
                        <small>{reportDescription(r)}</small>
                        {reportPending[r.id] && <small>Формула уточняется</small>}
                      </span>
                      <ChevronRight size={20} aria-hidden="true" />
                    </button>
                  ))}
                </div>
              </section>
            ) : null;
          })}
        {!shown.length && (
          <Empty
            title="Отчёт не найден"
            text="Попробуйте другое слово или выберите другую категорию."
          />
        )}
      </div>
    </section>
  );
}
