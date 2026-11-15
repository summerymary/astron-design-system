import { useState } from 'react';
import { Button, Modal } from './ui';
import { hiddenPhone } from '../lib/client-display';
export function CallDialog({
  name,
  phone,
  hidden = false,
  onClose,
}: {
  name: string;
  phone: string;
  hidden?: boolean;
  onClose: () => void;
}) {
  const [active, setActive] = useState(false);
  return (
    <Modal title="Звонок" subtitle={name} onClose={onClose}>
      <div className="ws-stack">
        <p>{hidden ? hiddenPhone(phone) : phone}</p>
        <p role="status">
          {active
            ? 'Демонстрационный звонок идёт'
            : 'Звонок будет имитирован без внешнего соединения.'}
        </p>
        <div className="modal-actions">
          <Button variant="secondary" onClick={onClose}>
            Закрыть
          </Button>
          <Button onClick={() => (active ? onClose() : setActive(true))}>
            {active ? 'Завершить звонок' : 'Начать демозвонок'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
