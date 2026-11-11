import { useEffect, useId, useRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ArrowUpRight, Check, CircleAlert, Inbox, Info, Plus, X } from 'lucide-react';
import type { Member, MemberStatus, Scenario } from '../types';
import { statusLabels } from '../data/mock';
import { feedbackTone, statusTone } from '../lib/ui-semantics';
import type { StatusTone } from '../lib/ui-semantics';
import { lockScroll } from '../lib/overlay';

export function Button({
  variant = 'primary',
  size = 'default',
  type = 'button',
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'accent' | 'danger' | 'danger-ghost';
  size?: 'default' | 'compact';
  children: ReactNode;
}) {
  return (
    <button
      type={type}
      data-ui="button"
      data-size={size}
      className={`button button-${variant} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Badge({ status }: { status: MemberStatus }) {
  return (
    <StatusBadge
      className={`badge badge-${status}`}
      tone={status === 'active' ? 'success' : status === 'expiring' ? 'warning' : 'paused'}
    >
      {statusLabels[status]}
    </StatusBadge>
  );
}

export function StatusBadge({
  children,
  tone,
  className = '',
}: {
  children: ReactNode;
  tone?: StatusTone;
  className?: string;
}) {
  return (
    <span
      data-ui="status"
      data-tone={tone || statusTone(String(children))}
      className={`ui-status ${className}`}
    >
      <i aria-hidden="true" />
      {children}
    </span>
  );
}

export function CountBadge({ children }: { children: ReactNode }) {
  return (
    <span className="count-badge" data-ui="count">
      {children}
    </span>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className="ui-switch"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span className="ui-switch-track" aria-hidden="true">
        <i />
      </span>
      {label}
    </button>
  );
}

export function IconButton({
  label,
  children,
  tone = 'default',
  variant = 'ghost',
  className = '',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  children: ReactNode;
  tone?: 'default' | 'danger';
  variant?: 'ghost' | 'secondary';
}) {
  return (
    <button
      {...props}
      type={type}
      data-ui="icon-button"
      data-tone={tone}
      data-variant={variant}
      className={`icon-button ${className}`}
      aria-label={label}
      title={props.title || label}
    >
      {children}
    </button>
  );
}

export function Avatar({
  member,
  small = false,
  portrait = false,
}: {
  member: Pick<Member, 'name' | 'color' | 'photoIndex'>;
  small?: boolean;
  portrait?: boolean;
}) {
  return (
    <span
      className={`avatar avatar-${member.color} ${small ? 'avatar-small' : ''} ${member.photoIndex !== undefined ? 'avatar-photo' : ''}`}
      style={
        member.photoIndex !== undefined && !portrait
          ? {
              backgroundImage: 'url("./demo/client-portraits.png")',
              backgroundPosition: `${(member.photoIndex % 3) * 50}% ${Math.floor(member.photoIndex / 3) * 100}%`,
            }
          : undefined
      }
      aria-hidden="true"
    >
      {portrait && member.photoIndex !== undefined && (
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="xMidYMid slice"
          width="100%"
          height="100%"
          aria-hidden="true"
        >
          <image
            href="./demo/client-portraits.png"
            x={-(member.photoIndex % 3) * 100}
            y={-Math.floor(member.photoIndex / 3) * 100}
            width="300"
            height="200"
            preserveAspectRatio="none"
          />
        </svg>
      )}
      {member.photoIndex === undefined &&
        member.name
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
      ).filter(
        (n) =>
          !n.hasAttribute('disabled') && n.getClientRects().length > 0 && !n.closest('[inert]'),
      );
    focusable()[0]?.focus();
    const handle = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const dialogs = Array.from(
        document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]'),
      ).filter((dialog) => dialog.getClientRects().length);
      if (dialogs.at(-1) !== el) return;
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
    const unlockScroll = lockScroll(document.body);
    document.addEventListener('keydown', handle);
    return () => {
      document.removeEventListener('keydown', handle);
      unlockScroll();
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
          <IconButton label="Закрыть" onClick={onClose}>
            <X size={20} />
          </IconButton>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Toast({
  message,
  tone = feedbackTone(message),
}: {
  message: string;
  tone?: 'success' | 'danger' | 'info';
}) {
  return (
    <div className="toast" data-tone={tone} role={tone === 'danger' ? 'alert' : 'status'}>
      <span>
        {tone === 'success' ? (
          <Check size={18} />
        ) : tone === 'danger' ? (
          <CircleAlert size={18} />
        ) : (
          <Info size={18} />
        )}
      </span>
      {message}
    </div>
  );
}

export function ConfirmDialog({
  title,
  subject,
  description,
  confirmLabel,
  cancelLabel = 'Отмена',
  onConfirm,
  onClose,
  children,
}: {
  title: string;
  subject?: string;
  description?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
  children?: ReactNode;
}) {
  return createPortal(
    <Modal title={title} subtitle={subject} onClose={onClose}>
      {description && <p className="ui-confirm-description">{description}</p>}
      {children}
      <div className="modal-actions">
        <Button variant="secondary" onClick={onClose}>
          {cancelLabel}
        </Button>
        <Button variant="danger" onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>,
    document.body,
  );
}

export function TextLink({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" className="text-link" onClick={onClick}>
      {children}
      <ArrowUpRight size={15} />
    </button>
  );
}
