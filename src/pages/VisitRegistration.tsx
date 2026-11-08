import { useState } from 'react';
import type { Member, VisitKind } from '../types';
import type { Navigate } from '../components/WorkspaceUI';
import { Button } from '../components/ui';
import { ClientSearch } from '../components/ClientSearch';
import { MembershipCard } from '../components/MembershipCard';
import { Empty, Notice } from '../components/WorkspaceUI';
import { useWorkspace } from '../components/WorkspaceProvider';
import { getClientProfile } from '../data/clientProfile';
import { membershipKinds, quantityLabel } from '../data/membership-kinds';
import { TODAY } from '../data/workspace';
import { passUnavailable, usePass } from '../lib/registration';

export function RegistrationWorkspace({
  members,
  initialMember,
  clubName,
  onRegister,
  onMember,
  navigate,
}: {
  members: Member[];
  initialMember: Member | null;
  clubName: string;
  onRegister: (member: Member, kind: VisitKind, passName?: string, passId?: string) => void;
  onMember: (member: Member) => void;
  navigate: Navigate;
}) {
  const { data, put } = useWorkspace();
  const [selected, setSelected] = useState<Member | null>(initialMember);
  const [choosing, setChoosing] = useState(false);
  const [passId, setPassId] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const passes = selected
    ? getClientProfile(
        members.find((member) => member.id === selected.id) || selected,
        data,
      ).subscriptions.filter((pass) => pass.kindId)
    : [];
  const pass = passes.find((pass) => pass.id === passId);
  return (
    <div className="ws-stack registration-workspace">
      {!selected && (
        <section className="panel ws-panel client-picker-panel">
          <div className="ws-panel-heading">
            <div>
              <h2>Найдите клиента</h2>
              <p>Телефон, ФИО или номер карты. Поиск не регистрирует посещение.</p>
            </div>
          </div>
          <div className="ws-panel-body">
            <ClientSearch
              mode="selection"
              members={members}
              onMember={(member) => {
                setSelected(member);
                setChoosing(false);
                setPassId('');
                setDone(false);
                setError('');
              }}
            />
          </div>
        </section>
      )}
      {selected ? (
        <section className="panel ws-panel">
          <div className="ws-panel-heading">
            <div>
              <h2>{selected.name}</h2>
              <p>
                {selected.phone} · {clubName}
              </p>
            </div>
            <div className="ws-actions">
              <Button
                variant="ghost"
                onClick={() => {
                  setSelected(null);
                  setChoosing(false);
                  setPassId('');
                  setDone(false);
                }}
              >
                Другой клиент
              </Button>
              <Button variant="secondary" onClick={() => onMember(selected)}>
                Карточка клиента
              </Button>
            </div>
          </div>
          <div className="ws-panel-body ws-stack">
            {done ? (
              <Notice tone="success">
                Посещение зарегистрировано по абонементу «{pass?.name}». Оно появилось в журнале и
                карточке клиента.
              </Notice>
            ) : (
              <div className="ws-actions">
                {!choosing && (
                  <Button
                    onClick={() => {
                      setChoosing(true);
                      const available = passes.filter((pass) => !passUnavailable(pass));
                      setPassId(available.length === 1 ? available[0].id : '');
                    }}
                  >
                    Зарегистрировать посещение
                  </Button>
                )}
                <Button variant="secondary" onClick={() => navigate('services', selected)}>
                  Продать
                </Button>
              </div>
            )}
            {choosing && !done && (
              <>
                <div>
                  <h3>Выберите абонемент для посещения</h3>
                  <p className="form-note">
                    Будет использовано одно посещение выбранной карты. Подтвердите регистрацию ниже.
                  </p>
                </div>
                <div className="plastic-card-grid">
                  {passes.map((item) => {
                    const unavailable = passUnavailable(item);
                    return (
                      <div key={item.id}>
                        <button
                          className="plastic-choice"
                          disabled={!!unavailable}
                          aria-pressed={passId === item.id}
                          onClick={() => {
                            setPassId(item.id);
                            setError('');
                          }}
                        >
                          <MembershipCard
                            compact
                            name={item.name}
                            kindId={item.kindId}
                            detail={
                              unavailable ||
                              (item.status === 'pending'
                                ? 'Активируется при посещении'
                                : 'Действует')
                            }
                            footer={
                              item.remaining === null
                                ? 'Без ограничений'
                                : `Осталось: ${quantityLabel(item.remaining, 'visit')}`
                            }
                          />
                        </button>
                      </div>
                    );
                  })}
                </div>
                {!passes.some((item) => !passUnavailable(item)) && (
                  <Empty
                    title="Нет доступных абонементов"
                    text="Можно продать клиенту новую карту."
                    action={<Button onClick={() => navigate('services', selected)}>Продать</Button>}
                  />
                )}
                <div className="ws-actions">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setChoosing(false);
                      setPassId('');
                    }}
                  >
                    Отмена
                  </Button>
                  <Button
                    disabled={!pass || !!passUnavailable(pass)}
                    onClick={() => {
                      if (!pass || done) return;
                      try {
                        const kind = membershipKinds.find((kind) => kind.id === pass.kindId);
                        const issued = (data['issued-plans'] || []).find(
                          (row) => row.id === pass.id,
                        );
                        const usage = usePass(
                          selected,
                          pass,
                          Number(issued?.duration || kind?.duration || 30),
                          TODAY,
                        );
                        put('pass-usage', usage);
                        onRegister(
                          selected,
                          kind?.id === 'group'
                            ? 'group'
                            : kind?.id === 'personal'
                              ? 'personal'
                              : 'gym',
                          pass.name,
                          pass.id,
                        );
                        setDone(true);
                      } catch (err) {
                        setError(err instanceof Error ? err.message : 'Проверьте абонемент');
                      }
                    }}
                  >
                    Подтвердить посещение
                  </Button>
                </div>
                {error && <p role="alert">{error}</p>}
              </>
            )}
            {done && (
              <div className="ws-actions">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSelected(null);
                    setChoosing(false);
                    setPassId('');
                    setDone(false);
                  }}
                >
                  Следующий клиент
                </Button>
                <Button variant="secondary" onClick={() => navigate('services', selected)}>
                  Продать
                </Button>
              </div>
            )}
          </div>
        </section>
      ) : (
        <Empty
          title="Выберите клиента из результатов поиска"
          text="Затем можно зарегистрировать посещение или перейти к продаже."
        />
      )}
    </div>
  );
}
