import { useState } from 'react';
import type { Member } from '../types';
import { Avatar, Button, Modal } from './ui';
import { ClientPhotoField } from './ClientPhotoField';

export function ClientPhotoDialog({
  member,
  onClose,
  onSave,
}: {
  member: Member;
  onClose: () => void;
  onSave: (photoDataUrl: string) => void;
}) {
  const [photo, setPhoto] = useState(member.photoDataUrl || '');
  const [busy, setBusy] = useState(false);
  return (
    <Modal title="Фото клиента" subtitle={member.fullName || member.name} onClose={onClose}>
      <ClientPhotoField
        value={photo}
        onChange={setPhoto}
        onBusyChange={setBusy}
        fallback={<Avatar member={member} portrait />}
        hasExistingPhoto={!!member.photoDataUrl || member.photoIndex !== undefined}
        showHeading={false}
      />
      <div className="modal-actions">
        <Button variant="secondary" onClick={onClose}>
          Отмена
        </Button>
        <Button
          disabled={busy || photo === (member.photoDataUrl || '')}
          onClick={() => onSave(photo)}
        >
          Сохранить фото
        </Button>
      </div>
    </Modal>
  );
}
