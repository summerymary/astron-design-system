import { useState } from 'react';
import { ArrowLeft, Plus } from 'lucide-react';
import type { DemoUser } from '../types';
import { money } from '../data/workspace';
import { canTopUpCompany, companyBalance } from '../lib/company-accounts';
import { useWorkspace } from '../components/WorkspaceProvider';
import { CompanyTopUpDialog } from '../components/CompanyTopUpDialog';
import {
  DataTable,
  Empty,
  Notice,
  SearchBox,
  SegmentedFilter,
  Stats,
  Status,
} from '../components/WorkspaceUI';
import { Button, Modal } from '../components/ui';
import type { DemoRecord } from '../data/workspace';
import type { Navigate } from '../components/WorkspaceUI';
import '../styles/companies.css';

export function CompaniesWorkspace({
  user,
  clubName,
  recordId,
  onRecord,
  navigate,
}: {
  user: DemoUser;
  clubName: string;
  recordId: string | null;
  onRecord: (id: string | null) => void;
  navigate: Navigate;
}) {
  const { data } = useWorkspace();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('active');
  const [topup, setTopup] = useState(false);
  const [detail, setDetail] = useState<DemoRecord | null>(null);
  const [message, setMessage] = useState('');
  const company = data.companies.find((row) => row.id === recordId);
  const clubId = data.clubs.find((row) => row.name === clubName.split(' · ').at(-1))?.id || '';
  const mayTopUp = canTopUpCompany(user) && user.clubIds.includes(clubId);
  const words = query.toLocaleLowerCase('ru').replaceAll('ё', 'е').trim().split(/\s+/);
  const rows = data.companies
    .filter(
      (row) =>
        (status === 'all' || row.status === 'Активна') &&
        words.every((word) =>
          `${row.name} ${row.account} ${row.contract}`
            .toLocaleLowerCase('ru')
            .replaceAll('ё', 'е')
            .includes(word),
        ),
    )
    .map((row) => ({ ...row, balance: String(companyBalance(data, row.id) / 100) }));
  const operations = company
    ? [...data['company-account-operations']]
        .filter((row) => row.companyId === company.id)
        .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`))
    : [];
  return (
    <div className="ws-stack companies-workspace">
      {message && <Notice tone="success">{message}</Notice>}
      {recordId && !company ? (
        <Empty
          title="Компания не найдена"
          text="Вернитесь к списку компаний."
          action={<Button onClick={() => onRecord(null)}>К компаниям</Button>}
        />
      ) : company ? (
        <>
          <div className="ws-actions">
            <Button
              variant="ghost"
              onClick={() => {
                onRecord(null);
                setMessage('');
              }}
            >
              <ArrowLeft size={18} />
              Все компании
            </Button>
          </div>
          <section className="panel ws-panel-body ws-stack">
            <div className="company-heading">
              <div>
                <h2>{company.name}</h2>
                <p className="ws-muted">
                  Счёт {company.account} · договор {company.contract}
                </p>
              </div>
              <Status tone={company.status === 'Активна' ? 'success' : 'neutral'}>
                {company.status}
              </Status>
            </div>
            <Stats
              items={[
                {
                  label: 'На счёте компании',
                  value: money(companyBalance(data, company.id) / 100),
                },
              ]}
            />
            <p className="ws-muted">
              Средства компании учитываются на отдельном счёте. Личные счета сотрудников ведутся в
              их карточках.
            </p>
            {company.status !== 'Активна' ? (
              <Notice>Компания в архиве. История доступна, пополнение закрыто.</Notice>
            ) : mayTopUp ? (
              <div className="ws-actions">
                <Button onClick={() => setTopup(true)}>
                  <Plus size={18} />
                  Пополнить счёт
                </Button>
              </div>
            ) : (
              <Notice>
                Просмотр счёта. Пополнение выполняет администратор или директор в своём клубе.
              </Notice>
            )}
          </section>
          <section className="panel ws-panel-body ws-stack">
            <div className="company-heading">
              <h2>История пополнений</h2>
              <Button variant="ghost" onClick={() => navigate('cash')}>
                Журнал кассы
              </Button>
            </div>
            <DataTable
              tableLabel="История пополнений счёта компании"
              rows={operations}
              onOpen={setDetail}
              columns={[
                {
                  key: 'date',
                  label: 'Дата',
                  render: (row) => `${row.date.split('-').reverse().join('.')} · ${row.time}`,
                },
                { key: 'amount', label: 'Зачислено', render: (row) => money(row.amount) },
                { key: 'method', label: 'Оплата' },
                { key: 'club', label: 'Клуб' },
                { key: 'cashier', label: 'Сотрудник' },
              ]}
              empty={
                <Empty
                  title="Пополнений пока нет"
                  text="После зачисления здесь появятся сумма, способ оплаты и сотрудник."
                />
              }
            />
            <p className="ws-muted">
              Начальный остаток демопримера: {money(company.openingBalance)}. В историю входят
              пополнения, выполненные в этом прототипе.
            </p>
          </section>
        </>
      ) : (
        <>
          <p className="ws-muted">
            Корпоративные клиенты: счета компаний, пополнение наличными или картой и история
            операций.
          </p>
          <div className="company-filters">
            <SearchBox
              value={query}
              onChange={setQuery}
              label="Поиск компании"
              placeholder="Компания, счёт или договор"
            />
            <SegmentedFilter
              label="Статус компании"
              items={[
                { id: 'active', label: 'Активные' },
                { id: 'all', label: 'Все компании' },
              ]}
              value={status}
              onChange={setStatus}
            />
          </div>
          <section className="panel ws-panel-body">
            <DataTable
              rows={rows}
              tableLabel="Компании и остатки на счетах"
              onOpen={(row) => onRecord(row.id)}
              columns={[
                { key: 'name', label: 'Компания' },
                { key: 'account', label: 'Счёт' },
                { key: 'contract', label: 'Договор' },
                { key: 'balance', label: 'На счёте', render: (row) => money(row.balance) },
                { key: 'status', label: 'Статус' },
              ]}
              empty={
                <Empty
                  title="Компания не найдена"
                  text="Проверьте название, счёт или договор."
                  action={
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setQuery('');
                        setStatus('all');
                      }}
                    >
                      Сбросить фильтры
                    </Button>
                  }
                />
              }
            />
          </section>
        </>
      )}
      {topup && company && (
        <CompanyTopUpDialog
          company={company}
          clubId={clubId}
          user={user}
          onClose={() => setTopup(false)}
          onSuccess={(text) => {
            setTopup(false);
            setMessage(text);
          }}
        />
      )}
      {detail && (
        <Modal
          title="Пополнение счёта компании"
          subtitle={`${company?.name} · ${detail.account}`}
          onClose={() => setDetail(null)}
        >
          <div className="ws-form">
            <dl className="company-facts">
              {Object.entries({
                Операция: detail.id,
                Дата: `${detail.date} · ${detail.time}`,
                Зачислено: money(detail.amount),
                'Остаток после операции': money(detail.balance),
                Оплата: detail.method,
                Клуб: detail.club,
                Сотрудник: detail.cashier,
                'Номер демочека': detail.receiptNumber || 'Не сформирован',
                Комментарий: detail.comment || '—',
              }).map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <Button variant="secondary" onClick={() => setDetail(null)}>
              Закрыть
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
