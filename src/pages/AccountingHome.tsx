import { NavigationCard } from '../components/WorkspaceUI';
import { Button } from '../components/ui';
import { Stats, SectionLinks } from '../components/WorkspaceUI';
import type { Navigate } from '../components/WorkspaceUI';
import { useWorkspace } from '../components/WorkspaceProvider';
import { cashFlow, cashJournal, cashTotals, filterCashJournal } from '../lib/cash';
import { money, prettyDate, TODAY } from '../data/workspace';
import '../styles/crm.css';

export function AccountingHome({ navigate, clubName }: { navigate: Navigate; clubName: string }) {
  const { data } = useWorkspace();
  const club = clubName.split(' · ').at(-1) || 'Центральный';
  const rows = filterCashJournal(
    cashJournal(data.ledger, data['cash-events'] || []),
    TODAY,
    club,
    'all',
  );
  const totals = cashTotals(rows);
  return (
    <div className="ws-stack accounting-home">
      <p className="ws-muted">
        {prettyDate(TODAY)} · {club}
      </p>
      <Stats
        items={[
          { label: 'Приход денег', value: money(totals.income / 100) },
          { label: 'Расход денег', value: money(totals.expense / 100) },
          { label: 'Кассовые операции', value: rows.length },
        ]}
      />
      <div className="crm-home-links">
        <NavigationCard
          onClick={() => navigate('cash')}
          title={<>Касса и операции</>}
          caption={<>Журнал, наличные, ККМ и терминал.</>}
        />
        <NavigationCard
          onClick={() => navigate('statistics')}
          title={<>Финансовые отчёты</>}
          caption={<>Продажи и способы оплаты по клубам.</>}
        />
        <NavigationCard
          onClick={() => navigate('services')}
          title={<>Оформить продажу</>}
          caption={<>Клиент, покупка и оплата.</>}
        />
        <NavigationCard
          onClick={() => navigate('payroll')}
          title={<>Расчёт зарплаты</>}
          caption={<>Смены, часы и начисления.</>}
        />
      </div>
      <SectionLinks ids={['inventory', 'memberships']} navigate={navigate} />
      <section className="panel ws-panel accounting-recent">
        <div className="ws-panel-heading">
          <h2>Последние операции</h2>
          <Button variant="ghost" onClick={() => navigate('cash')}>
            Весь журнал
          </Button>
        </div>
        <div
          className="ws-panel-body ws-stack home-records"
          role="region"
          aria-label="Последние кассовые операции"
          tabIndex={0}
        >
          {rows.slice(0, 5).map((row) => {
            const flow = cashFlow(row);
            return (
              <div className="ws-list-line" key={row.id}>
                <span>
                  <strong>{row.name}</strong>
                  <small className="cash-cell-sub cash-muted">
                    {row.time || '—'} · {row.method}
                  </small>
                </span>
                <strong>
                  {flow.expense || flow.income
                    ? `${flow.expense ? '−' : '+'}${money((flow.expense || flow.income) / 100)}`
                    : 'Без движения денег'}
                </strong>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
