import { useState } from 'react';
import { ArrowUpRight, Plus } from 'lucide-react';
import { Avatar, Button, Modal } from './ui';
import { FieldControl, Notice, RecordForm } from './WorkspaceUI';
import { clientCard } from '../lib/member-search';
import { memberCards } from '../data/admin';
import { clientName, hiddenPhone } from '../lib/client-display';
import {
  findMemberDuplicates,
  memberContactError,
  memberUpdateDraft,
} from '../lib/member-duplicates';
import type { NewMemberDraft } from '../lib/member-duplicates';
import type { Member } from '../types';
import { ClientPhotoField } from './ClientPhotoField';
import '../styles/new-member.css';

export function NewMemberDialog({
  members,
  hidePhones,
  onClose,
  onOpen,
  onCreate,
  onUpdate,
}: {
  members: Member[];
  hidePhones: boolean;
  onClose: () => void;
  onOpen: (member: Member) => void;
  onCreate: (draft: NewMemberDraft, reviewed: boolean) => void | string;
  onUpdate: (member: Member) => void | string;
}) {
  const [draft, setDraft] = useState<NewMemberDraft>({
    fullName: '',
    birthDate: '',
    phone: '',
    email: '',
  });
  const [reviewed, setReviewed] = useState(false);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState<Member | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const matches = findMemberDuplicates(members, draft);
  const change = (key: keyof NewMemberDraft, value: string) => {
    setDraft((previous) => ({ ...previous, [key]: value }));
    setReviewed(false);
    setError('');
  };
  return (
    <>
      <Modal size="large" title="Новый клиент" onClose={onClose}>
        <form
          className="new-client-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (photoBusy) return setError('Сделайте снимок или выключите камеру.');
            const problem = memberContactError(draft);
            if (problem) return setError(problem);
            if (matches.length && !reviewed)
              return setError(
                'Проверьте существующие карточки или подтвердите создание отдельного клиента.',
              );
            const result = onCreate(draft, reviewed);
            if (typeof result === 'string') setError(result);
          }}
        >
          <div className="new-client-body">
            <div className="new-client-layout">
              <div className="ws-fields">
                <FieldControl
                  field={{ key: 'fullName', label: 'Фамилия, имя, отчество', required: true }}
                  value={draft.fullName}
                  onChange={(value) => change('fullName', value)}
                />
                <FieldControl
                  field={{ key: 'birthDate', label: 'Дата рождения', type: 'date' }}
                  value={draft.birthDate}
                  onChange={(value) => change('birthDate', value)}
                />
                <FieldControl
                  field={{ key: 'phone', label: 'Телефон', type: 'tel' }}
                  value={draft.phone}
                  onChange={(value) => change('phone', value)}
                />
                <FieldControl
                  field={{ key: 'email', label: 'Электронная почта', type: 'email' }}
                  value={draft.email}
                  onChange={(value) => change('email', value)}
                />
              </div>
              <ClientPhotoField
                value={draft.photoDataUrl || ''}
                onChange={(photoDataUrl) => change('photoDataUrl', photoDataUrl)}
                onBusyChange={setPhotoBusy}
              />
            </div>
            {!!matches.length && (
              <section className="new-client-matches" aria-label="Возможные совпадения клиентов">
                <Notice tone="warning">
                  <strong>Возможно, клиент уже есть в базе</strong>
                  <p>
                    Проверьте карточку. Если изменились телефон, ФИО или другие данные, обновите
                    существующего клиента.
                  </p>
                </Notice>
                <ul className="new-client-match-list">
                  {matches.map((match) => (
                    <li key={match.member.id}>
                      <p className="new-client-match-reason">
                        {match.sameIdentity && match.samePhone
                          ? 'Совпадают ФИО, дата рождения и телефон'
                          : match.samePhone
                            ? 'Совпадает номер телефона'
                            : `Совпадают ФИО и дата рождения${draft.phone.trim() ? ' · телефон отличается' : ''}`}
                      </p>
                      <Button
                        variant="secondary"
                        className="new-client-match-card"
                        aria-label={`Открыть карточку: ${clientName(match.member)}`}
                        onClick={() => onOpen(match.member)}
                      >
                        <Avatar member={match.member} />
                        <span>
                          <strong>{clientName(match.member)}</strong>
                          <small>
                            Карта {clientCard(match.member, memberCards)} ·{' '}
                            {hidePhones ? hiddenPhone(match.member.phone) : match.member.phone}
                            {match.member.archived ? ' · В архиве' : ''}
                          </small>
                        </span>
                        <ArrowUpRight size={18} />
                      </Button>
                      <Button
                        variant="ghost"
                        aria-label={`Обновить данные: ${clientName(match.member)}`}
                        onClick={() => setUpdating(match.member)}
                      >
                        Обновить данные
                      </Button>
                    </li>
                  ))}
                </ul>
                <label className="new-client-review">
                  <input
                    type="checkbox"
                    checked={reviewed}
                    onChange={(event) => setReviewed(event.target.checked)}
                  />
                  <span>Карточки проверены. Это другой клиент — создать отдельную карточку.</span>
                </label>
              </section>
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <p className="new-client-note">Данные сохранятся в памяти до обновления страницы.</p>
          </div>
          <div className="modal-actions">
            <Button variant="secondary" onClick={onClose}>
              Отмена
            </Button>
            <Button type="submit" disabled={photoBusy || (!!matches.length && !reviewed)}>
              <Plus size={16} />
              {matches.length ? 'Создать отдельного клиента' : 'Добавить клиента'}
            </Button>
          </div>
        </form>
      </Modal>
      {updating && (
        <RecordForm
          title="Обновить данные клиента"
          fields={[
            { key: 'fullName', label: 'Фамилия, имя, отчество', required: true },
            { key: 'birthDate', label: 'Дата рождения', type: 'date' },
            { key: 'phone', label: 'Телефон', type: 'tel' },
            { key: 'email', label: 'Электронная почта', type: 'email' },
          ]}
          initial={memberUpdateDraft(updating, draft)}
          onClose={() => setUpdating(null)}
          onSave={(record) => {
            const problem = memberContactError({
              fullName: record.fullName,
              phone: record.phone,
              birthDate: record.birthDate,
            });
            if (problem) return problem;
            const result = onUpdate({
              ...updating,
              name: record.fullName.trim(),
              fullName: record.fullName.trim(),
              birthDate: record.birthDate,
              phone: record.phone.trim() || 'Не указан',
              email: record.email.trim(),
            });
            if (typeof result === 'string') return result;
            setUpdating(null);
          }}
        >
          <Notice>
            Существующая карточка: <strong>{clientName(updating)}</strong>, карта{' '}
            {clientCard(updating, memberCards)}. Проверьте подставленные данные перед сохранением.
            Абонементы и история сохранятся.
          </Notice>
        </RecordForm>
      )}
    </>
  );
}
