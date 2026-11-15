import { useState } from 'react';
import type { Member, Visit } from '../types';
import type { DemoSubscription } from '../data/clientProfile';
import { TODAY } from '../data/workspace';
import { demoStamp, nextDemoNow } from '../lib/demo-clock';
import { changeMembership } from '../lib/membership-operations';
import { clientName } from '../lib/client-display';
import { addDays } from '../lib/schedule';
import { demoId, useWorkspace } from './WorkspaceProvider';
import { Button, ConfirmDialog, Modal } from './ui';
import { ClientSearch } from './ClientSearch';
import { DataTable, Notice } from './WorkspaceUI';

export function MembershipDetails({
  pass,
  member,
  members,
  visits,
  canOperate,
  onClose,
}: {
  pass: DemoSubscription;
  member: Member;
  members: Member[];
  visits: Visit[];
  canOperate: boolean;
  onClose: () => void;
}) {
  const { data, transact } = useWorkspace();
  const [action, setAction] = useState<'freeze' | 'finish' | 'transfer' | 'contract' | null>(null);
  const [until, setUntil] = useState(addDays(TODAY, 7));
  const [reason, setReason] = useState('');
  const [target, setTarget] = useState<Member | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState('');
  const history = visits.filter(
    (visit) => visit.passId === pass.id || (!visit.passId && visit.plan === pass.name),
  );
  const override = (data['membership-overrides'] || []).find(
    (row) => row.id === `${member.id}:${pass.id}`,
  );
  const change = (kind: 'freeze' | 'unfreeze' | 'finish' | 'transfer') => {
    try {
      transact((current) =>
        changeMembership(current, {
          member,
          passId: pass.id,
          kind,
          target,
          until,
          reason,
          today: TODAY,
          stamp: demoStamp(nextDemoNow()),
          actionId: demoId('pass-action'),
          canOperate,
        }),
      );
      onClose();
    } catch (err) {
      setError((err as Error).message);
      setConfirm(false);
    }
  };
  return (
    <Modal title={pass.name} subtitle={clientName(member)} size="wide" onClose={onClose}>
      <div className="modal-scroll-body ws-stack">
        <dl className="ws-facts">
          <div>
            <dt>Покупка</dt>
            <dd>{pass.boughtAt}</dd>
          </div>
          <div>
            <dt>Активация</dt>
            <dd>{pass.activatedAt || 'Не активирован'}</dd>
          </div>
          <div>
            <dt>Окончание</dt>
            <dd>{pass.endsAt || 'После активации'}</dd>
          </div>
          <div>
            <dt>Остаток</dt>
            <dd>{pass.remaining === null ? 'Безлимит' : pass.remaining}</dd>
          </div>
        </dl>
        <h3>История посещений по абонементу</h3>
        <DataTable
          rows={history.map((visit) => ({
            id: visit.id,
            name: visit.enteredAt.replace('T', ' · '),
            kind:
              visit.kind === 'personal'
                ? 'Персональная'
                : visit.kind === 'group'
                  ? 'Групповая'
                  : 'Тренажёрный зал',
            club: visit.clubId,
          }))}
          columns={[
            { key: 'name', label: 'Дата посещения' },
            { key: 'kind', label: 'Вид посещения' },
            { key: 'club', label: 'Клуб' },
          ]}
          empty={<p>Сохранённых посещений по этому абонементу нет.</p>}
        />
        {(data['membership-history'] || []).some((row) => row.passId === pass.id) && (
          <DataTable
            rows={(data['membership-history'] || []).filter((row) => row.passId === pass.id)}
            columns={[
              { key: 'date', label: 'Когда' },
              { key: 'name', label: 'Операция' },
              { key: 'comment', label: 'Основание' },
            ]}
          />
        )}
        {override?.transferredTo && (
          <Notice>Абонемент переоформлен. История прежнего владельца сохранена.</Notice>
        )}
        {canOperate && pass.status !== 'expired' && (
          <div className="ws-actions">
            <Button variant="secondary" onClick={() => setAction('freeze')}>
              {pass.status === 'paused' ? 'Разморозить' : 'Заморозить'}
            </Button>
            <Button variant="secondary" onClick={() => setAction('transfer')}>
              Переоформить
            </Button>
            <Button variant="danger-ghost" onClick={() => setAction('finish')}>
              Списать…
            </Button>
          </div>
        )}
        <Button variant="secondary" onClick={() => setAction('contract')}>
          Демо-договор / печатный вид
        </Button>
        {action === 'contract' && (
          <section className="panel ws-panel-body ws-stack">
            <h3>Демонстрационный документ</h3>
            <p>
              {clientName(member)} · {pass.name}
            </p>
            <p>
              Покупка {pass.boughtAt}. Действует до {pass.endsAt || 'активации'}.
            </p>
            <Notice>
              Это образец состава документа, а не юридический договор клуба. При внедрении
              используется утверждённый шаблон.
            </Notice>
            <Button variant="secondary" onClick={() => window.print()}>
              Распечатать страницу
            </Button>
          </section>
        )}
        {action && action !== 'contract' && (
          <div className="ws-stack">
            <h3>
              {action === 'transfer'
                ? 'Переоформить на другого клиента'
                : action === 'finish'
                  ? 'Завершить абонемент'
                  : pass.status === 'paused'
                    ? 'Разморозить абонемент'
                    : 'Заморозить абонемент'}
            </h3>
            {action === 'freeze' && pass.status !== 'paused' && (
              <label className="form-field">
                <span>Заморозить до</span>
                <input
                  type="date"
                  min={addDays(TODAY, 1)}
                  max={addDays(TODAY, 90)}
                  value={until}
                  onChange={(event) => setUntil(event.target.value)}
                />
              </label>
            )}
            {action === 'transfer' &&
              (target ? (
                <div className="ws-list-line">
                  <strong>{clientName(target)}</strong>
                  <Button variant="ghost" onClick={() => setTarget(null)}>
                    Изменить
                  </Button>
                </div>
              ) : (
                <ClientSearch
                  mode="selection"
                  purpose="покупки"
                  hidePhones
                  members={members.filter((item) => item.id !== member.id && !item.archived)}
                  onMember={setTarget}
                />
              ))}
            <label className="form-field">
              <span>Основание *</span>
              <textarea
                rows={2}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
            <Notice>
              {action === 'transfer'
                ? 'Перенесутся оставшиеся посещения, срок и ограничения. Прежние визиты останутся у первоначального владельца.'
                : action === 'finish'
                  ? 'Абонемент завершится, оставшиеся посещения станут недоступны. Возврат денег отдельно не оформляется.'
                  : pass.status === 'paused'
                    ? 'Доступ по абонементу будет восстановлен.'
                    : 'До разморозки посещения будут недоступны. Конец действия будет продлён на выбранный срок заморозки.'}
            </Notice>
            {error && <Notice tone="warning">{error}</Notice>}
            <Button
              variant={action === 'finish' ? 'danger' : 'primary'}
              disabled={!reason.trim() || (action === 'transfer' && !target)}
              onClick={() => setConfirm(true)}
            >
              Продолжить…
            </Button>
          </div>
        )}
      </div>
      <div className="modal-actions">
        <Button variant="secondary" onClick={onClose}>
          Закрыть
        </Button>
      </div>
      {confirm && action && action !== 'contract' && (
        <ConfirmDialog
          title="Подтвердить изменение абонемента?"
          subject={pass.name}
          description={reason}
          confirmLabel="Подтвердить"
          onClose={() => setConfirm(false)}
          onConfirm={() =>
            change(action === 'freeze' && pass.status === 'paused' ? 'unfreeze' : action)
          }
        />
      )}
    </Modal>
  );
}
