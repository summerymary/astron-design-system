import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { DemoRecord } from '../data/workspace';
import { money } from '../data/workspace';
import type { DemoUser } from '../types';
import { companyBalance, companyTopUpCents, topUpCompany } from '../lib/company-accounts';
import { demoStamp, nextDemoNow } from '../lib/demo-clock';
import { demoId, useWorkspace } from './WorkspaceProvider';
import { ReceptionPayment, initialReceptionPayment } from './ReceptionPayment';
import { Field } from './Field';
import { Button, Modal } from './ui';
import { Notice } from './WorkspaceUI';

export function CompanyTopUpDialog({
  company,
  clubId,
  user,
  onClose,
  onSuccess,
}: {
  company: DemoRecord;
  clubId: string;
  user: DemoUser;
  onClose: () => void;
  onSuccess: (message: string) => void;
}) {
  const { data, transact } = useWorkspace();
  const [amount, setAmount] = useState('');
  const [comment, setComment] = useState('');
  const [payment, setPayment] = useState(initialReceptionPayment);
  const [review, setReview] = useState(false);
  const [received, setReceived] = useState(false);
  const [error, setError] = useState('');
  const [id] = useState(() => demoId('company'));
  const submitted = useRef(false);
  const balance = companyBalance(data, company.id);
  const value = Number(amount.replace(',', '.')) || 0;
  const club = data.clubs.find((row) => row.id === clubId);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (submitted.current) return;
    try {
      const cents = companyTopUpCents(amount);
      if (!review) {
        setReview(true);
        return;
      }
      transact((previous) =>
        topUpCompany(
          previous,
          {
            id,
            companyId: company.id,
            amount,
            comment,
            method: payment.method as 'Наличные' | 'Безналичная оплата',
            receipt: payment.receipt,
            received,
            clubId,
            stamp: demoStamp(nextDemoNow()),
          },
          user,
        ),
      );
      submitted.current = true;
      onSuccess(`На счёт ${company.account} · ${company.name} зачислено ${money(cents / 100)}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось провести пополнение.');
    }
  };
  return (
    <Modal
      title={review ? 'Проверка пополнения' : 'Пополнить счёт компании'}
      subtitle={`${company.name} · счёт ${company.account}`}
      onClose={onClose}
    >
      <form className="ws-form company-topup" onSubmit={submit}>
        {review ? (
          <>
            <dl className="company-facts">
              {Object.entries({
                Компания: company.name,
                'Счёт компании': company.account,
                'К зачислению': money(value),
                Оплата:
                  payment.method === 'Безналичная оплата' ? 'Банковская карта' : payment.method,
                'Сейчас на счёте': money(balance / 100),
                'После зачисления': money(balance / 100 + value),
                Клуб: club?.name || 'Не выбран',
                Администратор: user.name,
                'Демонстрационный чек': payment.receipt ? 'Сформировать' : 'Не формировать',
                Комментарий: comment || '—',
              }).map(([label, text]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{text}</dd>
                </div>
              ))}
            </dl>
            <label className="registration-supervision-check">
              <input
                type="checkbox"
                checked={received}
                onChange={(event) => setReceived(event.target.checked)}
              />
              {payment.method === 'Наличные'
                ? 'Наличные получены'
                : 'Оплата картой подтверждена на терминале'}
            </label>
          </>
        ) : (
          <>
            <Field
              className="form-field"
              label="Сумма пополнения, ₽"
              hint={`Сейчас на счёте ${money(balance / 100)}`}
            >
              <input
                inputMode="decimal"
                value={amount}
                required
                maxLength={16}
                onChange={(event) => {
                  setAmount(event.target.value);
                  setError('');
                }}
              />
            </Field>
            <ReceptionPayment
              value={payment}
              onChange={setPayment}
              total={value > 0 && Number.isFinite(value) ? value : 0}
              allowSplit={false}
              allowGift={false}
              allowCredit={false}
            />
            <Field
              className="form-field"
              label="Комментарий"
              hint="Например, номер договора или имя представителя компании"
            >
              <textarea
                value={comment}
                maxLength={300}
                rows={2}
                onChange={(event) => setComment(event.target.value)}
              />
            </Field>
          </>
        )}
        <Notice>Демонстрация: реальное списание с карты и печать чека не выполняются.</Notice>
        {error && (
          <p className="ws-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <Button
            variant="secondary"
            onClick={() => {
              if (review) {
                setReview(false);
                setReceived(false);
                setError('');
              } else onClose();
            }}
          >
            {review ? 'Назад' : 'Отмена'}
          </Button>
          <Button type="submit">
            {review ? 'Подтвердить пополнение' : 'Проверить пополнение'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
