import { useState } from 'react';
import { reportDescription, reportTitle } from '../data/statistics';
import { familyCatalogue, reportCategories } from '../data/report-families';
import type { ReportDefinition } from '../data/statistics';
import { matchesSearch } from '../lib/directory-search';
import { Empty, SearchBox, Tabs, NavigationCard } from './WorkspaceUI';
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
  const found = familyCatalogue(reports).filter((family) =>
    matchesSearch(
      `${family.title} ${family.description} ${family.available.map((r) => `${reportTitle(r)} ${r.sourceTitle} ${reportDescription(r)}`).join(' ')}`,
      query,
    ),
  );
  const shown = found.filter((r) => group === 'all' || r.category === group);
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
          ...reportCategories.map((g) => ({
            ...g,
            label: g.shortLabel,
            count: found.filter((r) => r.category === g.id).length,
          })),
        ]}
      />
      <div className="ws-panel-body statistics-catalogue-groups">
        {reportCategories
          .filter((g) => group === 'all' || g.id === group)
          .map((g) => {
            const rows = shown.filter((r) => r.category === g.id);
            return rows.length ? (
              <section key={g.id}>
                <h3>{g.label}</h3>
                <div className="ws-card-grid">
                  {rows.map((r) => (
                    <NavigationCard
                      key={r.id}
                      title={r.title}
                      caption={r.description}
                      onClick={() => onOpen(r.primaryId)}
                    />
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
