import { useState } from 'react';
import { ClubLogo } from './ClubLogo';
import { ClientSearch } from './ClientSearch';
import type { Member } from '../types';
import {
  ChevronDown,
  MessageSquare,
  Plus,
  PhoneIncoming,
  ShieldCheck,
  Star,
  UserRound,
  CupSoda,
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
}: {
  workstationId: string;
  onWorkstation: (id: string) => void;
  members: Member[];
  onMember: (member: Member) => void;
  onAction: (id: AdminSectionId) => void;
  name: string;
}) {
  const [open, setOpen] = useState(false);
  const [callsEnabled, setCallsEnabled] = useState(false);
  const workplace = workstations.find((w) => w.id === workstationId)!;
  const club = demoClubs.find((c) => c.id === workplace.clubId)!;
  return (
    <div className="admin-header-content">
      <div className="workstation-control">
        <button
          className="workstation-button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-label="Рабочая зона"
        >
          <ClubLogo brand={club.brand} variant="compact" decorative />
          <span>
            <strong>{club.name}</strong>
            <small>{workplace.name} · Рабочая зона</small>
          </span>
          <ChevronDown size={14} />
        </button>
        {open && (
          <>
            <button
              className="workstation-dismiss"
              aria-label="Закрыть выбор рабочей зоны"
              onClick={() => setOpen(false)}
            />
            <div className="workstation-menu">
              <div>
                <strong>Рабочая зона</strong>
                <button
                  className="icon-button"
                  onClick={() => setOpen(false)}
                  aria-label="Закрыть список рабочих мест"
                >
                  <X size={15} />
                </button>
              </div>
              <p>Клуб и ресепшен для текущей работы</p>
              {workstations.map((w) => (
                <button
                  key={w.id}
                  className={w.id === workstationId ? 'selected' : ''}
                  onClick={() => {
                    onWorkstation(w.id);
                    setOpen(false);
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
          </>
        )}
      </div>
      <ClientSearch key={workstationId} members={members} onMember={onMember} />
      <div className="admin-header-actions">
        <button className="header-visit-action" onClick={() => onAction('registration')}>
          <Plus size={15} />
          <span>Посещение</span>
        </button>
        <button className="header-bar-action" onClick={() => onAction('bar')}>
          <CupSoda size={16} />
          <span>Бар</span>
        </button>
      </div>
      <div className="admin-header-indicators">
        <button
          className={`icon-button header-call-button ${callsEnabled ? 'calls-enabled' : ''}`}
          aria-label="Уведомления о звонках"
          aria-pressed={callsEnabled}
          title="Уведомления о звонках"
          onClick={() => setCallsEnabled(!callsEnabled)}
        >
          <PhoneIncoming size={16} />
        </button>
        <span className="system-health" title="Демонстрационное состояние системы">
          <ShieldCheck size={15} />
          <span>Всё работает</span>
        </span>
        <button
          aria-label="Онлайн-заявки: 1"
          className="header-inbox"
          onClick={() => onAction('requests')}
        >
          <span>Заявки</span>
          <b>1</b>
        </button>
        <button className="icon-button" aria-label="Сообщения" onClick={() => onAction('messages')}>
          <MessageSquare size={16} />
        </button>
        <button className="icon-button" aria-label="Отзывы" onClick={() => onAction('reviews')}>
          <Star size={16} />
        </button>
        <span className="admin-user-avatar" title={`${name} · Администратор`} aria-label={name}>
          <UserRound size={17} />
        </span>
      </div>
    </div>
  );
}
