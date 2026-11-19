import { useState } from 'react';
import type { Member } from '../types';
import type { DemoRecord } from '../data/workspace';
import { money, prettyDate } from '../data/workspace';
import { getClientProfile } from '../data/clientProfile';
import { clientFinanceRows, clientFinanceTotals, financeCents } from '../lib/client-finance';
import { reissueModes } from '../lib/membership-reissue';
import { matchesSearch } from '../lib/directory-search';
import { useWorkspace } from './WorkspaceProvider';
import { DataTable, SearchBox, SegmentedFilter, Stats } from './WorkspaceUI';
import { Button, Modal } from './ui';

export function ClientFinanceJournal({ member, members }: { member: Member; members: Member[] }) {
  const { data } = useWorkspace();
  const profile = getClientProfile(member, data);
  const rows = clientFinanceRows(member, members, data, profile.openingBalance);
  const totals = clientFinanceTotals(member, members, data);
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState('all');
  const [selected, setSelected] = useState<DemoRecord | null>(null);
  const shown = rows.filter(
    (row) =>
      (group === 'all' ||
        row.group === group ||
        (group === 'account' && row.group === 'opening')) &&
      matchesSearch(`${row.type} ${row.description} ${row.operationId} ${row.method || ''}`, query),
  );
  const summaryRows: DemoRecord[] = [];
  for (const [kind, direction, label] of [
    ['account', 'credit', 'Поступило на лицевой счёт'],
    ['account', 'debit', 'Списано с лицевого счёта'],
    ['purchase', 'debit', 'Оплачено покупок'],
    ['purchase', 'credit', 'Возвращено клиенту'],
  ]) {
    const list = shown.filter((row) => row.group === kind && row.direction === direction);
    if (list.length)
      summaryRows.push({
        id: `total:${kind}:${direction}`,
        group: 'summary',
        type: label,
        direction: 'neutral',
        amount: list.every((row) => row.amount !== '')
          ? String(list.reduce((sum, row) => sum + financeCents(row.amount), 0) / 100)
          : '',
        stamp: '',
        description: '',
        operationId: '',
      });
  }
  const reissue =
    selected && (data['membership-reissues'] || []).find((row) => row.id === selected.operationId);
  const amount = (row: DemoRecord) =>
    row.amount === ''
      ? '—'
      : `${Number(row.amount) === 0 ? '' : row.direction === 'credit' ? '+' : row.direction === 'debit' ? '−' : ''}${money(row.amount)}`;
  return (
    <section className="ws-stack" data-ui="client-finance-journal" aria-label="Финансы клиента">
      <Stats
        items={[
          { label: 'Лицевой счёт', value: money(profile.balance) },
          {
            label: 'Оплачено покупок',
            value: totals.paid === null ? 'Неизвестно' : money(totals.paid),
          },
          { label: 'Задолженность', value: money(totals.debt) },
        ]}
      />
      <p className="ws-muted">
        Покупки и движения по лицевому счёту показаны отдельно. Входящий остаток не является новым
        поступлением.
      </p>
      <SegmentedFilter
        label="Вид финансовых операций"
        items={[
          { id: 'all', label: 'Все операции' },
          { id: 'account', label: 'Лицевой счёт' },
          { id: 'purchase', label: 'Покупки и возвраты' },
        ]}
        value={group}
        onChange={setGroup}
      />
      <SearchBox value={query} onChange={setQuery} placeholder="Описание или номер операции" />
      <DataTable
        rows={shown}
        footerRows={summaryRows}
        tableLabel="Финансовые операции клиента"
        columns={[
          { key: 'type', label: 'Тип операции' },
          {
            key: 'amount',
            label: 'Сумма',
            render: (row) => (
              <strong className="client-finance-amount" data-direction={row.direction}>
                {amount(row)}
              </strong>
            ),
          },
          {
            key: 'stamp',
            label: 'Время операции',
            render: (row) =>
              row.stamp ? prettyDate(row.stamp) : row.group === 'summary' ? '' : 'Не указано',
          },
          {
            key: 'description',
            label: 'Описание',
            render: (row) => (
              <>
                {row.description}
                {Number(row.debt) > 0 && (
                  <small className="ws-muted"> · В долг {money(row.debt)}</small>
                )}
              </>
            ),
          },
          {
            key: 'operationId',
            label: 'Финансовая операция',
            render: (row) =>
              row.operationId ? (
                <Button variant="ghost" size="compact" onClick={() => setSelected(row)}>
                  {row.operationId}
                </Button>
              ) : row.group === 'summary' ? (
                ''
              ) : (
                '—'
              ),
          },
        ]}
      />
      {selected && (
        <Modal
          title="Финансовая операция"
          subtitle={selected.operationId}
          size="wide"
          onClose={() => setSelected(null)}
        >
          <div className="modal-scroll-body ws-stack">
            <dl className="ws-facts">
              <div>
                <dt>Тип</dt>
                <dd>{selected.type}</dd>
              </div>
              <div>
                <dt>Сумма</dt>
                <dd>{amount(selected)}</dd>
              </div>
              <div>
                <dt>Время</dt>
                <dd>{selected.stamp ? prettyDate(selected.stamp) : 'Не указано'}</dd>
              </div>
              <div>
                <dt>Способ оплаты</dt>
                <dd>
                  {selected.method ||
                    (selected.group === 'account' ? 'Внутреннее движение ЛС' : 'Не указан')}
                </dd>
              </div>
              <div>
                <dt>Описание</dt>
                <dd>{selected.description}</dd>
              </div>
              <div>
                <dt>Сотрудник</dt>
                <dd>{selected.cashier || 'Не указан'}</dd>
              </div>
              {selected.club && (
                <div>
                  <dt>Клуб</dt>
                  <dd>{selected.club}</dd>
                </div>
              )}
              {selected.receiptNumber && (
                <div>
                  <dt>Демочек</dt>
                  <dd>{selected.receiptNumber}</dd>
                </div>
              )}
              {Number(selected.debt) > 0 && (
                <div>
                  <dt>В долг</dt>
                  <dd>{money(selected.debt)}</dd>
                </div>
              )}
            </dl>
            {reissue && (
              <>
                <h3>
                  {reissue.sourceName} → {reissue.targetName}
                </h3>
                <p>{reissue.formula}</p>
                <dl className="ws-facts">
                  <div>
                    <dt>Способ перерасчёта</dt>
                    <dd>
                      {reissueModes.find((mode) => mode.id === reissue.mode)?.label || reissue.mode}
                    </dd>
                  </div>
                  <div>
                    <dt>Источник цены покупки</dt>
                    <dd>{reissue.priceOrigin}</dd>
                  </div>
                  <div>
                    <dt>К зачёту</dt>
                    <dd>{money(reissue.credit)}</dd>
                  </div>
                  <div>
                    <dt>Цена нового</dt>
                    <dd>{money(reissue.targetPrice)}</dd>
                  </div>
                  <div>
                    <dt>Доплата</dt>
                    <dd>{money(reissue.due)}</dd>
                  </div>
                  <div>
                    <dt>Остаток на ЛС</dt>
                    <dd>{money(reissue.balanceCredit)}</dd>
                  </div>
                </dl>
                <p>Основание: {reissue.reason}</p>
              </>
            )}
          </div>
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => setSelected(null)}>
              Закрыть
            </Button>
          </div>
        </Modal>
      )}
    </section>
  );
}
