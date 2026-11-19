import { useRef, useState } from 'react';
import type { DemoUser, Member } from '../types';
import type { DemoSubscription } from '../data/clientProfile';
import { TODAY, money } from '../data/workspace';
import { demoStamp, nextDemoNow } from '../lib/demo-clock';
import {
  membershipPurchasePrice,
  quoteMembershipReissue,
  reissueMembership,
  reissueModes,
} from '../lib/membership-reissue';
import type { ReissueMode } from '../lib/membership-reissue';
import { saleTrainerSelection } from '../lib/personal-training';
import { saleCatalog } from '../lib/sale-catalog';
import { supportsTraining } from '../lib/training-kind';
import { matchesSearch } from '../lib/directory-search';
import { demoId, useWorkspace } from './WorkspaceProvider';
import { Field } from './Field';
import { Select } from './Select';
import { Button, Modal } from './ui';
import { Notice, SearchBox, SegmentedFilter } from './WorkspaceUI';
import { ReceptionPayment, initialReceptionPayment } from './ReceptionPayment';

export function MembershipReissueDialog({
  pass,
  member,
  members,
  user,
  clubName,
  canOperate,
  onClose,
  onSuccess,
}: {
  pass: DemoSubscription;
  member: Member;
  members: Member[];
  user: DemoUser;
  clubName: string;
  canOperate: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { data, transact } = useWorkspace();
  const [mode, setMode] = useState<ReissueMode>(
    pass.status === 'paused' ? 'manual' : pass.remaining === null ? 'days' : 'visits',
  );
  const [purchasePrice, setPurchasePrice] = useState('');
  const [singlePrice, setSinglePrice] = useState('');
  const [manualCredit, setManualCredit] = useState('');
  const [planId, setPlanId] = useState('');
  const [trainerId, setTrainerId] = useState('');
  const [query, setQuery] = useState('');
  const [reason, setReason] = useState('');
  const [payment, setPayment] = useState(initialReceptionPayment);
  const [review, setReview] = useState<ReturnType<typeof quoteMembershipReissue> | null>(null);
  const [error, setError] = useState('');
  const [id] = useState(() => demoId('reissue'));
  const submitted = useRef(false);
  const known = membershipPurchasePrice(data, member.id, pass.id);
  const trainers = saleTrainerSelection(data, member.id, trainerId);
  const plans = saleCatalog(data, null, trainers.selected?.categoryId || null).filter(
    (item) => item.type === 'plan',
  );
  const visible = plans.filter((item) => matchesSearch(item.record.name, query));
  const input = {
    passId: pass.id,
    planId,
    mode,
    today: TODAY,
    purchasePrice,
    singlePrice,
    manualCredit,
    trainerId: trainers.selected?.id || '',
  };
  const calculate = () => {
    setError('');
    if (!reason.trim()) {
      setError('Укажите основание переоформления.');
      return;
    }
    try {
      setReview(quoteMembershipReissue(data, member, input));
    } catch (err) {
      setError((err as Error).message);
    }
  };
  const submit = () => {
    if (!review || submitted.current) return;
    try {
      transact((current) =>
        reissueMembership(
          current,
          member,
          {
            ...input,
            id,
            reason,
            stamp: demoStamp(nextDemoNow()),
            club: clubName.split(' · ').at(-1) || clubName,
            expected: review.signature,
            payment,
          },
          user,
          canOperate,
        ),
      );
      submitted.current = true;
      onSuccess();
    } catch (err) {
      setError((err as Error).message);
    }
  };
  const facts =
    review &&
    ([
      ['Цена покупки исходного', review.purchase],
      ['К зачёту', review.credit],
      ['Цена нового абонемента', review.price],
      ['Зачтено в оплату нового', review.applied],
      ['Доплатить', review.due],
      ['Останется на лицевом счёте', review.balanceCredit],
    ] as const);
  return (
    <Modal
      title="Переоформить абонемент"
      subtitle={member.fullName || member.name}
      size="wide"
      onClose={onClose}
    >
      <div className="modal-scroll-body ws-stack">
        {review ? (
          <>
            <h3>
              {review.pass.name} → {review.plan.name}
            </h3>
            <dl className="ws-facts">
              {facts &&
                facts.map(([label, cents]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{money(cents / 100)}</dd>
                  </div>
                ))}
            </dl>
            <Notice>{review.explanation}</Notice>
            {review.trainer && (
              <p>
                Тренер: {review.trainer.name} · {review.trainer.category}
              </p>
            )}
            <p>Основание: {reason}</p>
            <p className="ws-muted">
              Исходный абонемент завершится. Новый будет выдан этому же клиенту и начнёт действовать
              после активации. Остаток стоимости зачислится на лицевой счёт.
            </p>
            {review.due > 0 && (
              <ReceptionPayment
                value={payment}
                onChange={setPayment}
                total={review.due / 100}
                member={member}
                members={members}
              />
            )}
          </>
        ) : (
          <>
            <h3>Исходный абонемент: {pass.name}</h3>
            <dl className="ws-facts">
              <div>
                <dt>Использовано</dt>
                <dd>{pass.used} посещений</dd>
              </div>
              <div>
                <dt>Остаток</dt>
                <dd>{pass.remaining === null ? 'Безлимит' : `${pass.remaining} посещений`}</dd>
              </div>
              <div>
                <dt>{known.origin}</dt>
                <dd>{known.cents === null ? 'Нужно указать' : money(known.cents / 100)}</dd>
              </div>
              <div>
                <dt>Срок</dt>
                <dd>
                  {pass.activatedAt || 'Не активирован'} — {pass.endsAt || 'После активации'}
                </dd>
              </div>
            </dl>
            {known.cents === null && (
              <Field label="Цена исходной покупки, ₽" required>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={purchasePrice}
                  onChange={(event) => setPurchasePrice(event.target.value)}
                />
              </Field>
            )}
            <SegmentedFilter
              label="Способ перерасчёта"
              items={[...reissueModes]}
              value={mode}
              onChange={(value) => {
                setMode(value as ReissueMode);
                setError('');
              }}
            />
            {mode === 'visits' && (
              <p className="ws-muted">
                Цена покупки × оставшиеся посещения / исходное число посещений.
              </p>
            )}
            {mode === 'days' && (
              <p className="ws-muted">
                Цена покупки × оставшиеся календарные дни / полный срок. Сегодня и день окончания
                включены. После заморозок выберите другой способ.
              </p>
            )}
            {mode === 'single' && (
              <Field label="Цена разового посещения, ₽" required>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={singlePrice}
                  onChange={(event) => setSinglePrice(event.target.value)}
                />
              </Field>
            )}
            {mode === 'manual' && (
              <Field label="Сумма к зачёту, ₽" required>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={manualCredit}
                  onChange={(event) => setManualCredit(event.target.value)}
                />
              </Field>
            )}
            <h3>Новый абонемент</h3>
            <SearchBox
              value={query}
              onChange={(value) => {
                setQuery(value);
                setPlanId('');
              }}
              placeholder="Найти абонемент по названию"
            />
            <Field label="Персональный тренер (для тарифов ПТ)">
              <Select
                value={trainers.selected?.id || ''}
                onChange={(event) => {
                  setTrainerId(event.target.value);
                  setPlanId('');
                }}
              >
                <option value="">Выберите тренера</option>
                {trainers.trainers.map((trainer) => (
                  <option key={trainer.id} value={trainer.id}>
                    {trainer.name} · {trainer.category}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Новый абонемент" required>
              <Select value={planId} onChange={(event) => setPlanId(event.target.value)}>
                <option value="">Выберите абонемент</option>
                {visible.map(({ record }) => (
                  <option key={record.id} value={record.id}>
                    {record.name} · {money(record.price)}
                  </option>
                ))}
              </Select>
            </Field>
            {planId &&
              supportsTraining(
                {
                  training: plans.find((item) => item.record.id === planId)?.record.training,
                  kindId: plans.find((item) => item.record.id === planId)?.record.kindId,
                },
                'personal',
              ) && <p className="ws-muted">Категория тарифа соответствует выбранному тренеру.</p>}
            <Field label="Основание переоформления" required>
              <textarea
                rows={2}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </Field>
          </>
        )}
        {error && <Notice tone="warning">{error}</Notice>}
      </div>
      <div className="modal-actions">
        {review && (
          <Button
            variant="secondary"
            onClick={() => {
              setReview(null);
              setError('');
            }}
          >
            К расчёту
          </Button>
        )}
        <Button variant="secondary" onClick={onClose}>
          Отмена
        </Button>
        <Button variant="primary" disabled={!canOperate} onClick={review ? submit : calculate}>
          {review
            ? review.due
              ? `Переоформить · доплата ${money(review.due / 100)}`
              : 'Подтвердить переоформление'
            : 'Рассчитать'}
        </Button>
      </div>
    </Modal>
  );
}
