import { useEffect, useId, useRef, useState } from 'react';
import { ClubLogo } from './ClubLogo';
import { ClientSearch } from './ClientSearch';
import { useWorkspace } from './WorkspaceProvider';
import type { Member } from '../types';
import {
  ChevronDown,
  MessageSquare,
  Plus,
  PhoneIncoming,
  ShieldCheck,
  Bell,
  UserRound,
  CalendarDays,
  LockKeyhole,
  ShoppingBag,
  X,
} from 'lucide-react';
import { demoClubs } from '../data/roles';
import { workstations } from '../data/admin';
import type { AdminSectionId } from '../data/admin';

export function AdminHeader({
  workstationId,
  onWorkstation,
  members,
  onMember,
  onAction,
  name,
  onLock,
  onAddClient,
  activeSection,
}: {
  workstationId: string;
  onWorkstation: (id: string) => void;
  members: Member[];
  onMember: (member: Member) => void;
  onAction: (id: AdminSectionId) => void;
  name: string;
  onLock: () => void;
  onAddClient: () => void;
  activeSection?: AdminSectionId;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const options = useRef<HTMLDivElement>(null);
  const listId = useId();
  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };
  useEffect(() => {
    if (open) options.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus();
  }, [open]);
  const { data } = useWorkspace();
  const newLeads = data.leads.filter((row) => row.stage === 'Новая').length;
  const unread = data.notifications.filter((row) => row.status === 'Новое').length;
  const workplace = workstations.find((w) => w.id === workstationId)!;
  const club = demoClubs.find((c) => c.id === workplace.clubId)!;
  return (
    <div className="admin-header-content">
      <div
        className="workstation-control"
        onKeyDown={(event) => {
          if (event.key === 'Tab' && open) close();
          if (event.key === 'Escape' && open) {
            event.preventDefault();
            event.stopPropagation();
            close();
          }
        }}
      >
        <button
          className="workstation-button"
          ref={trigger}
          aria-haspopup="listbox"
          aria-controls={open ? listId : undefined}
          onKeyDown={(event) => {
            if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
              event.preventDefault();
              setOpen(true);
            }
          }}
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-label={`Рабочая зона: ${club.name}, ${workplace.name}`}
          title={`${club.name} · ${workplace.name}`}
        >
          <ClubLogo brand={club.brand} variant="compact" decorative />
          <span>
            <strong>{club.name}</strong>
            <small>{workplace.name}</small>
          </span>
          <ChevronDown size={14} />
        </button>
        {open && (
          <>
            <button
              className="workstation-dismiss"
              aria-label="Закрыть выбор рабочей зоны"
              tabIndex={-1}
              onClick={close}
            />
            <div className="workstation-menu">
              <div>
                <strong>Рабочая зона</strong>
                <button
                  className="icon-button"
                  onClick={close}
                  aria-label="Закрыть список рабочих мест"
                >
                  <X size={15} />
                </button>
              </div>
              <p>Клуб и ресепшен для текущей работы</p>
              <div id={listId} role="listbox" aria-label="Рабочие места" ref={options}>
                {workstations.map((w, index) => (
                  <button
                    key={w.id}
                    role="option"
                    aria-selected={w.id === workstationId}
                    tabIndex={w.id === workstationId ? 0 : -1}
                    onKeyDown={(event) => {
                      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
                      event.preventDefault();
                      const next =
                        event.key === 'Home'
                          ? 0
                          : event.key === 'End'
                            ? workstations.length - 1
                            : (index + (event.key === 'ArrowDown' ? 1 : -1) + workstations.length) %
                              workstations.length;
                      options.current
                        ?.querySelectorAll<HTMLButtonElement>('[role="option"]')
                        [next]?.focus();
                    }}
                    className={w.id === workstationId ? 'selected' : ''}
                    onClick={() => {
                      onWorkstation(w.id);
                      close();
                    }}
                  >
                    <span>
                      {demoClubs.find((c) => c.id === w.clubId)!.name}
                      <small>{w.name}</small>
                    </span>
                    <i />
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
      <ClientSearch key={workstationId} members={members} onMember={onMember} hidePhones />
      <div className="admin-header-actions">
        <button
          className="header-add-client-action"
          aria-label="Добавить клиента"
          title="Добавить нового клиента"
          aria-haspopup="dialog"
          onClick={onAddClient}
        >
          <Plus size={16} />
          <span>Новый клиент</span>
        </button>
        <button
          className="header-schedule-action"
          aria-label="Расписание"
          title="Расписание"
          aria-current={activeSection === 'schedule' ? 'page' : undefined}
          onClick={() => onAction('schedule')}
        >
          <CalendarDays size={16} />
          <span>Расписание</span>
        </button>
        <button
          className="header-products-action"
          aria-label="Продажа товаров"
          title="Продажа товаров"
          aria-current={activeSection === 'products' ? 'page' : undefined}
          onClick={() => onAction('products')}
        >
          <ShoppingBag size={16} />
          <span>Товары</span>
        </button>
        <button className="header-sale-action" onClick={() => onAction('services')}>
          <ShoppingBag size={16} />
          <span>Продать</span>
        </button>
      </div>
      <div className="admin-header-indicators">
        <button
          className="icon-button header-call-button"
          aria-label="Журнал звонков"
          title="Журнал звонков"
          onClick={() => onAction('calls')}
        >
          <PhoneIncoming size={16} />
        </button>
        <span className="system-health" title="Демонстрационное состояние системы">
          <ShieldCheck size={15} />
          <span>Всё работает</span>
        </span>
        <button
          aria-label={`Онлайн-заявки: ${newLeads}`}
          className="header-inbox"
          onClick={() => onAction('requests')}
        >
          <span>Заявки</span>
          <b>{newLeads}</b>
        </button>
        <button className="icon-button" aria-label="Сообщения" onClick={() => onAction('messages')}>
          <MessageSquare size={16} />
        </button>
        <button
          className="icon-button"
          aria-label={`Уведомления: ${unread} новых`}
          onClick={() => onAction('notifications')}
        >
          <Bell size={16} />
        </button>
        <button
          className="admin-user-avatar"
          title={`${name} · Администратор`}
          aria-label={`Мой профиль: ${name}`}
          onClick={() => onAction('settings')}
        >
          <UserRound size={17} />
        </button>
      </div>
      <button
        className="icon-button admin-lock-button"
        aria-label="Заблокировать экран"
        title="Заблокировать экран"
        onClick={onLock}
      >
        <LockKeyhole size={18} />
      </button>
    </div>
  );
}
