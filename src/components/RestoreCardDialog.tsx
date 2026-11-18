import { Field } from './Field';
import { useState } from 'react';
import type { DemoUser, Member } from '../types';
import { memberCards } from '../data/admin';
import { clientCard, clientName } from '../lib/client-display';
import { cardNumberError, paidOperation, replaceRecord } from '../lib/reception-operations';
import { demoStamp, nextDemoNow } from '../lib/demo-clock';
import { demoId, useWorkspace } from './WorkspaceProvider';
import { Button, Modal } from './ui';
import { Notice } from './WorkspaceUI';
import { ReceptionPayment, initialReceptionPayment } from './ReceptionPayment';

export function RestoreCardDialog({
  member,
  members,
  user,
  clubName,
  onUpdate,
  onClose,
}: {
  member: Member;
  members: Member[];
  user: DemoUser;
  clubName: string;
  onUpdate: (member: Member) => void;
  onClose: () => void;
}) {
  const { data, transact } = useWorkspace();
  const [number, setNumber] = useState('');
  const [payment, setPayment] = useState(initialReceptionPayment);
  const [error, setError] = useState('');
  const price = Number(
    (data['reception-services'] || []).find((row) => row.id === 'restore-card')?.price || 100,
  );
  return (
    <Modal title="Восстановить карту" subtitle={clientName(member)} onClose={onClose}>
      <form
        className="ws-stack"
        onSubmit={(event) => {
          event.preventDefault();
          try {
            const problem = cardNumberError(number, member, members, memberCards);
            if (problem) throw new Error(problem);
            if (number.trim() === clientCard(member)) throw new Error('Введите новый номер карты.');
            const stamp = demoStamp(nextDemoNow());
            const id = demoId('card-restore');
            transact((current) =>
              replaceRecord(
                paidOperation(
                  current,
                  {
                    id,
                    name: 'Восстановление карты',
                    category: 'Услуги',
                    memberId: String(member.id),
                    client: clientName(member),
                    club: clubName.split(' · ').at(-1)!,
                    cashier: user.name,
                    date: stamp.slice(0, 10),
                    time: stamp.slice(11),
                  },
                  price,
                  payment,
                ),
                'card-replacements',
                {
                  id,
                  memberId: String(member.id),
                  oldCard: clientCard(member),
                  newCard: number.trim(),
                  date: stamp,
                  name: 'Восстановление карты',
                },
              ),
            );
            onUpdate({ ...member, cardNumber: number.trim() });
            onClose();
          } catch (err) {
            setError((err as Error).message);
          }
        }}
      >
        <Notice>
          Текущая карта {clientCard(member)} будет заменена после оплаты. Абонементы, счёт и история
          клиента сохранятся.
        </Notice>
        <Field className="form-field" label={<> Номер новой карты * </>}>
          <input
            required
            inputMode="numeric"
            pattern="[0-9]{3,16}"
            value={number}
            onChange={(event) => {
              setNumber(event.target.value);
              setError('');
            }}
          />
        </Field>
        <ReceptionPayment value={payment} onChange={setPayment} total={price} />
        {error && <Notice tone="warning">{error}</Notice>}
        <div className="modal-actions">
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit">Оплатить и восстановить</Button>
        </div>
      </form>
    </Modal>
  );
}
