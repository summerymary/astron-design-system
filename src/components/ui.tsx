import { useEffect, useId, useRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { ArrowUpRight, Check, CircleAlert, Inbox, Plus, X } from 'lucide-react';
import type { Member, MemberStatus, Scenario } from '../types';
import { statusLabels } from '../data/mock';

export function Button({
  variant = 'primary',
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost';
  children: ReactNode;
}) {
  return (
    <button className={`button button-${variant} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function Badge({ status }: { status: MemberStatus }) {
  return (
    <span className={`badge badge-${status}`}>
      <span />
      {statusLabels[status]}
    </span>
  );
}

export function Avatar({
  member,
  small = false,
}: {
  member: Pick<Member, 'name' | 'color'>;
  small?: boolean;
}) {
  return (
    <span
      className={`avatar avatar-${member.color} ${small ? 'avatar-small' : ''}`}
      aria-hidden="true"
    >
      {member.name
        .split(' ')
        .slice(0, 2)
        .map((n) => n[0])
        .join('')}
    </span>
  );
}

export function SectionTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-heading">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function StateContent({
  scenario,
  onReset,
  onAdd,
  entity = 'клиентов',
  emptyState,
}: {
  scenario: Scenario;
  onReset: () => void;
  onAdd: () => void;
  entity?: string;
  emptyState?: { title: string; description: string; actionLabel: string };
}) {
  if (scenario === 'loading')
    return (
      <div className="loading-layout" role="status" aria-label="Загрузка данных">
        <span className="sr-only">Загружаем данные…</span>
        <div className="skeleton-stats">
          {[1, 2, 3, 4].map((i) => (
            <div className="skeleton-card" key={i}>
              <i />
              <b />
              <i />
            </div>
          ))}
        </div>
        <div className="skeleton-panel">
          {[1, 2, 3, 4, 5].map((i) => (
            <div className="skeleton-line" key={i} />
          ))}
        </div>
        <p className="state-demo-note">Предпросмотр состояния загрузки</p>
      </div>
    );
  const isError = scenario === 'error';
  return (
    <div className="empty-state">
      <div className={`state-illustration ${isError ? 'is-error' : ''}`}>
        {isError ? (
          <CircleAlert size={34} strokeWidth={1.5} />
        ) : (
          <Inbox size={34} strokeWidth={1.5} />
        )}
        <span />
        <span />
      </div>
      <span className="eyebrow">{isError ? 'ЧТО-ТО ПОШЛО НЕ ТАК' : 'НАЧНЁМ С ПЕРВОГО ШАГА'}</span>
      <h2>
        {isError
          ? 'Не удалось загрузить данные'
          : (emptyState?.title ?? `Здесь пока нет ${entity}`)}
      </h2>
      <p>
        {isError
          ? 'Попробуйте ещё раз. Ваши данные останутся на месте.'
          : (emptyState?.description ??
            'Добавьте первого клиента — и пространство начнёт оживать.')}
      </p>
      <Button onClick={isError ? onReset : onAdd}>
        {isError ? (
          'Попробовать снова'
        ) : (
          <>
            {emptyState ? <ArrowUpRight size={16} /> : <Plus size={16} />}{' '}
            {emptyState?.actionLabel ?? 'Добавить клиента'}
          </>
        )}
      </Button>
      <span className="state-demo-note">Демонстрационное состояние</span>
    </div>
  );
}

export function Modal({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const el = ref.current!;
    const focusable = () =>
      Array.from(
        el.querySelectorAll<HTMLElement>(
          'button, input, select, textarea, a[href], [tabindex="0"]',
        ),
      ).filter((n) => !n.hasAttribute('disabled'));
    focusable()[0]?.focus();
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab') {
        const items = focusable();
        const first = items[0];
        const last = items.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handle);
    return () => {
      document.removeEventListener('keydown', handle);
      document.body.style.overflow = overflow;
      before?.focus();
    };
  }, [onClose]);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={ref}>
        <div className="modal-heading">
          <div>
            <h2 id={titleId}>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button className="icon-button" aria-label="Закрыть" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Toast({ message }: { message: string }) {
  return (
    <div className="toast" role="status">
      <span>
        <Check size={15} />
      </span>
      {message}
    </div>
  );
}

export function TextLink({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button className="text-link" onClick={onClick}>
      {children}
      <ArrowUpRight size={15} />
    </button>
  );
}
