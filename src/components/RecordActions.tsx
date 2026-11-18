import { useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { MoreHorizontal, Phone } from 'lucide-react';
import { IconButton } from './ui';

export function ClientLink({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" className="text-link client-link" data-ui="client-link" onClick={onClick}>
      {children}
    </button>
  );
}

export function PhoneAction({
  name,
  phone,
  onClick,
}: {
  name: string;
  phone: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="text-link phone-action"
      data-ui="phone-action"
      aria-label={`Позвонить: ${name}`}
      onClick={onClick}
    >
      <Phone size={16} aria-hidden="true" />
      <span>{phone}</span>
    </button>
  );
}

export function RowActions({
  label = 'Действия строки',
  actions,
}: {
  label?: string;
  actions: { label: string; onClick: () => void; disabled?: boolean }[];
}) {
  const id = useId(),
    menu = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  return (
    <span className="record-actions" data-ui="row-actions">
      <IconButton
        label={label}
        popoverTarget={id}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setPosition({
            left: Math.max(8, Math.min(innerWidth - 218, r.right - 210)),
            top: Math.max(8, Math.min(innerHeight - actions.length * 44 - 20, r.bottom + 4)),
          });
        }}
      >
        <MoreHorizontal size={20} />
      </IconButton>
      <div
        ref={menu}
        id={id}
        popover="auto"
        className="record-actions-menu"
        role="group"
        aria-label={label}
        style={position}
      >
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={() => {
              menu.current?.hidePopover();
              action.onClick();
            }}
            disabled={action.disabled}
          >
            {action.label}
          </button>
        ))}
      </div>
    </span>
  );
}
