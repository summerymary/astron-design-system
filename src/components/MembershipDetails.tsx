import { Field } from './Field';
import { useState } from 'react';
import type { Member, Visit, DemoUser } from '../types';
import type { DemoSubscription } from '../data/clientProfile';
import { TODAY, prettyDate, type DemoRecord } from '../data/workspace';
import { demoStamp, nextDemoNow } from '../lib/demo-clock';
import { changeMembership } from '../lib/membership-operations';
import { clientName } from '../lib/client-display';
import { addDays } from '../lib/schedule';
import { demoId, useWorkspace } from './WorkspaceProvider';
import { Button, ConfirmDialog, Modal, StatusBadge } from './ui';
import { MembershipReissueDialog } from './MembershipReissueDialog';
import { DataTable, Notice } from './WorkspaceUI';
import { membershipVisits } from '../lib/membership-visit-history';

export function MembershipDetails({
  pass,
  member,
  members,
  visits,
  canOperate,
  user,
  clubName,
  onCancelVisit,
  onClose,
}: {
  pass: DemoSubscription;
  member: Member;
  members: Member[];
  visits: Visit[];
  canOperate: boolean;
  user: DemoUser;
  clubName: string;
  onCancelVisit?: (passId: string, visit: Visit, reason: string) => void;
  onClose: () => void;
}) {
  const { data, transact } = useWorkspace();
  const [action, setAction] = useState<'freeze' | 'finish' | 'contract' | null>(null);
  const [until, setUntil] = useState(addDays(TODAY, 7));
  const [reason, setReason] = useState('');
  const [reissueOpen, setReissueOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState('');
  const [cancelVisit, setCancelVisit] = useState<Visit | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const history = membershipVisits(member, pass.id, visits, data);
  const dateTime = (value: string | null) => {
    if (!value) return 'Не указана';
    const [date, time] = value.split(/[T ]/);
    return `${/^\d{4}-/.test(date) ? prettyDate(date) : date}${time ? ` · ${time.slice(0, 5)}` : ''}`;
  };
  const clubLabel = (id: string) =>
    data.clubs.find((club) => club.id === id)?.name || id || 'Клуб не указан';
  const visitLabel = (visit: Visit) => {
    const receipt = (data['visit-bookings'] || []).find(
      (r) => r.memberId === String(member.id) && r.passId === pass.id && r.date === visit.enteredAt,
    );
    return (
      (data.events || []).find((e) => receipt?.eventId === e.id)?.name ||
      {
        personal: 'Персональная',
        group: 'Групповая',
        gym: 'Тренажёрный зал',
        online: 'Онлайн-тренировка',
      }[visit.kind]
    );
  };
  const override = (data['membership-overrides'] || []).find(
    (row) => row.id === `${member.id}:${pass.id}`,
  );
  const change = (kind: 'freeze' | 'unfreeze' | 'finish') => {
    try {
      transact((current) =>
        changeMembership(current, {
          member,
          passId: pass.id,
          kind,
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
    <Modal title="История абонемента" subtitle={clientName(member)} size="wide" onClose={onClose}>
      <div className="modal-scroll-body ws-stack">
        <div className="membership-detail-heading">
          <h3>{pass.name}</h3>
          <StatusBadge>
            {
              {
                active: 'Действует',
                pending: 'Не активирован',
                paused: 'Заморожен',
                expired: 'Завершён',
              }[pass.status]
            }
          </StatusBadge>
        </div>
        <dl className="ws-facts">
          <div>
            <dt>Покупка</dt>
            <dd>{dateTime(pass.boughtAt)}</dd>
          </div>
          <div>
            <dt>Активация</dt>
            <dd>{pass.activatedAt ? dateTime(pass.activatedAt) : 'Не активирован'}</dd>
          </div>
          <div>
            <dt>Окончание</dt>
            <dd>{pass.endsAt ? dateTime(pass.endsAt) : 'После активации'}</dd>
          </div>
          <div>
            <dt>Использовано посещений</dt>
            <dd>{pass.used}</dd>
          </div>
          <div>
            <dt>Номер абонемента</dt>
            <dd>{pass.id}</dd>
          </div>
          <div>
            <dt>Остаток</dt>
            <dd>{pass.remaining === null ? 'Безлимит' : pass.remaining}</dd>
          </div>
        </dl>
        <h3>История посещений по абонементу</h3>
        {pass.used > history.length && (
          <p className="ws-muted">
            В истории сохранено {history.length} из {pass.used} использованных посещений.
          </p>
        )}
        <DataTable
          rows={history.map((visit) => ({
            id: visit.id,
            name: dateTime(visit.enteredAt),
            kind: visitLabel(visit),
            club: clubLabel(visit.clubId),
          }))}
          columns={[
            { key: 'name', label: 'Дата посещения' },
            { key: 'kind', label: 'Вид посещения' },
            { key: 'club', label: 'Клуб' },
            ...(canOperate && onCancelVisit && !override?.reissuedTo && !override?.transferredTo
              ? [
                  {
                    key: 'cancel',
                    label: 'Действие',
                    render: (row: DemoRecord) => (
                      <Button
                        variant="danger-ghost"
                        size="compact"
                        onClick={() => {
                          setCancelVisit(history.find((v) => v.id === row.id)!);
                          setCancelReason('');
                          setError('');
                        }}
                      >
                        Отменить посещение…
                      </Button>
                    ),
                  },
                ]
              : []),
          ]}
          empty={<p>Сохранённых посещений по этому абонементу нет.</p>}
        />
        {(data['membership-history'] || []).some((row) => row.passId === pass.id) && (
          <DataTable
            rows={(data['membership-history'] || []).filter(
              (row) => row.passId === pass.id && row.memberId === String(member.id),
            )}
            columns={[
              { key: 'date', label: 'Когда' },
              { key: 'name', label: 'Операция' },
              { key: 'comment', label: 'Основание' },
            ]}
          />
        )}
        {override?.reissuedTo && (
          <Notice>
            Абонемент пересчитан на другой тариф. Новый абонемент и финансовые операции сохранены в
            карточке клиента.
          </Notice>
        )}
        {override?.transferredTo && (
          <Notice>Абонемент передан другому клиенту. История прежнего владельца сохранена.</Notice>
        )}
        {action === 'contract' && (
          <section className="panel ws-panel-body ws-stack membership-print-view">
            <h3>Демонстрационный документ</h3>
            <p>
              {clientName(member)} · {pass.name}
            </p>
            <p>
              Покупка {dateTime(pass.boughtAt)}. Активация:{' '}
              {pass.activatedAt ? dateTime(pass.activatedAt) : 'ожидается'}. Окончание:{' '}
              {pass.endsAt ? dateTime(pass.endsAt) : 'после активации'}.
            </p>
            <p>
              Абонемент № {pass.id}. Использовано: {pass.used}. Остаток:{' '}
              {pass.remaining === null ? 'Безлимит' : pass.remaining}.
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
              {action === 'finish'
                ? 'Завершить абонемент'
                : pass.status === 'paused'
                  ? 'Разморозить абонемент'
                  : 'Заморозить абонемент'}
            </h3>
            {action === 'freeze' && pass.status !== 'paused' && (
              <Field className="form-field" label={<> Заморозить до </>}>
                <input
                  type="date"
                  min={addDays(TODAY, 1)}
                  max={addDays(TODAY, 90)}
                  value={until}
                  onChange={(event) => setUntil(event.target.value)}
                />
              </Field>
            )}
            <Field className="form-field" label={<> Основание * </>}>
              <textarea
                rows={2}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </Field>
            <Notice>
              {action === 'finish'
                ? 'Абонемент завершится, оставшиеся посещения станут недоступны. Возврат денег отдельно не оформляется.'
                : pass.status === 'paused'
                  ? 'Доступ по абонементу будет восстановлен.'
                  : 'До разморозки посещения будут недоступны. Конец действия будет продлён на выбранный срок заморозки.'}
            </Notice>
            {error && <Notice tone="warning">{error}</Notice>}
            <Button
              variant={action === 'finish' ? 'danger' : 'primary'}
              disabled={!reason.trim()}
              onClick={() => setConfirm(true)}
            >
              Продолжить…
            </Button>
          </div>
        )}
      </div>
      <div className="modal-actions membership-detail-actions">
        {canOperate && pass.status !== 'expired' && (
          <>
            <Button variant="secondary" onClick={() => setAction('freeze')}>
              {pass.status === 'paused' ? 'Разморозить' : 'Заморозить'}
            </Button>
            <Button variant="danger-ghost" onClick={() => setAction('finish')}>
              Списать…
            </Button>
          </>
        )}
        <Button variant="secondary" onClick={() => setAction('contract')}>
          Договор
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            setAction('contract');
            setTimeout(() => window.print(), 0);
          }}
        >
          Распечатать
        </Button>
        {canOperate && pass.status !== 'expired' && (
          <Button
            variant="secondary"
            onClick={() => {
              setAction(null);
              setReissueOpen(true);
            }}
          >
            Переоформить
          </Button>
        )}
        <Button variant="secondary" onClick={onClose}>
          Закрыть
        </Button>
      </div>
      {reissueOpen && (
        <MembershipReissueDialog
          pass={pass}
          member={member}
          members={members}
          user={user}
          clubName={clubName}
          canOperate={canOperate}
          onClose={() => setReissueOpen(false)}
          onSuccess={onClose}
        />
      )}
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
      {cancelVisit && onCancelVisit && (
        <Modal
          title="Отменить посещение?"
          subtitle={dateTime(cancelVisit.enteredAt)}
          onClose={() => setCancelVisit(null)}
        >
          <div className="modal-scroll-body ws-stack">
            <p>
              Посещение исчезнет из журнала, списание вернётся на этот абонемент. Причина останется
              в истории.
            </p>
            <Field className="form-field" label={<> Причина отмены * </>}>
              <textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
            </Field>
            {error && <Notice tone="warning">{error}</Notice>}
          </div>
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => setCancelVisit(null)}>
              Назад
            </Button>
            <Button
              variant="danger"
              disabled={!cancelReason.trim()}
              onClick={() => {
                try {
                  onCancelVisit(pass.id, cancelVisit, cancelReason);
                  setCancelVisit(null);
                } catch (err) {
                  setError((err as Error).message);
                }
              }}
            >
              Отменить посещение
            </Button>
          </div>
        </Modal>
      )}
    </Modal>
  );
}
