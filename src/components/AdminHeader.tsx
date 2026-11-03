import { useState } from 'react';
import { ClubLogo } from './ClubLogo';
import {
  ChevronDown,
  CornerDownLeft,
  CreditCard,
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
  onCard,
  onAction,
  cardError,
  name,
}: {
  workstationId: string;
  onWorkstation: (id: string) => void;
  onCard: (card: string) => void;
  onAction: (id: AdminSectionId) => void;
  cardError: string;
  name: string;
}) {
  const [open, setOpen] = useState(false);
  const [card, setCard] = useState('');
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
      <form
        className={`quick-card ${cardError ? 'quick-card-error' : ''}`}
        onSubmit={(e) => {
          e.preventDefault();
          if (card.trim()) onCard(card.trim());
        }}
      >
        <CreditCard size={19} />
        <label className="sr-only" htmlFor="quick-card">
          Номер карты клиента
        </label>
        <input
          id="quick-card"
          inputMode="numeric"
          placeholder="Номер карты клиента"
          value={card}
          onChange={(e) => setCard(e.target.value)}
          aria-invalid={!!cardError}
          aria-describedby={cardError ? 'quick-card-error' : 'quick-card-help'}
        />
        <button type="submit" aria-label="Открыть карточку по карте" title="Открыть карточку">
          <CornerDownLeft size={16} />
        </button>
        <span
          className="quick-card-tooltip"
          id={cardError ? 'quick-card-error' : 'quick-card-help'}
        >
          {cardError || 'Пример карты: 100001 · Enter — карточка клиента'}
        </span>
      </form>
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
