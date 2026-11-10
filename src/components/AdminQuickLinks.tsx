import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Button, Modal } from './ui';
import { createPortal } from 'react-dom';
import {
  CalendarDays,
  CreditCard,
  Sparkles,
  Users,
  ShoppingBag,
  Wallet,
  ChevronRight,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { adminSections } from '../data/admin';
import type { AdminSectionId } from '../data/admin';
const shortcuts = [
  { id: 'schedule', icon: CalendarDays },
  { id: 'registration', icon: CreditCard },
  { id: 'services', icon: Sparkles },
  { id: 'members', icon: Users },
  { id: 'products', icon: ShoppingBag },
  { id: 'cash', icon: Wallet },
] satisfies {
  id: AdminSectionId;
  icon: LucideIcon;
}[];
export function AdminQuickLinks({
  onAction,
  persistent = false,
  activeId,
  pageKey,
  mobileMode = false,
  mobileOpen = false,
  onMobileOpenChange,
  onAllSections,
}: {
  onAction: (id: AdminSectionId) => void;
  persistent?: boolean;
  activeId?: AdminSectionId;
  pageKey?: string;
  mobileMode?: boolean;
  mobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
  onAllSections?: () => void;
}) {
  const [shortcutsExpanded, setShortcutsExpanded] = useState(false);
  const [smallViewport, setSmallViewport] = useState(
    () => window.matchMedia('(max-width: 700px)').matches,
  );
  const toggle = useRef<HTMLButtonElement>(null);
  const linksId = useId();
  useEffect(() => {
    const query = window.matchMedia('(max-width: 700px)');
    const update = () => setSmallViewport(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  useEffect(() => setShortcutsExpanded(false), [pageKey]);
  const closeMobile = useCallback(() => onMobileOpenChange?.(false), [onMobileOpenChange]);
  if (persistent && (mobileMode || smallViewport)) {
    if (!mobileOpen) return null;
    return createPortal(
      <Modal title="Быстрые действия" onClose={closeMobile}>
        <nav className="mobile-quick-actions" aria-label="Быстрые переходы администратора">
          {shortcuts.map(({ id, icon: Icon }) => {
            const section = adminSections.find((item) => item.id === id)!;
            return (
              <button
                key={id}
                aria-current={activeId === id ? 'page' : undefined}
                onClick={() => {
                  closeMobile();
                  onAction(id);
                }}
              >
                <Icon size={20} aria-hidden="true" />
                <span>{section.label}</span>
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            );
          })}
        </nav>
        {onAllSections && (
          <Button
            variant="secondary"
            className="mobile-all-sections"
            onClick={() => {
              closeMobile();
              onAllSections();
            }}
          >
            Все разделы
          </Button>
        )}
      </Modal>,
      document.body,
    );
  }
  const panel = (
    <>
      {persistent && shortcutsExpanded && (
        <button
          className="global-quick-dismiss"
          aria-label="Закрыть быстрые переходы"
          onClick={() => {
            setShortcutsExpanded(false);
            toggle.current?.focus();
          }}
        />
      )}
      <aside
        aria-label="Быстрые действия администратора"
        className={`admin-quick-panel ${persistent ? 'global-admin-quick' : ''} ${shortcutsExpanded ? 'shortcuts-open' : ''}`}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setShortcutsExpanded(false);
            toggle.current?.focus();
          }
        }}
      >
        <button
          ref={toggle}
          className="quick-mobile-toggle"
          aria-expanded={shortcutsExpanded}
          aria-controls={linksId}
          onClick={() => setShortcutsExpanded(!shortcutsExpanded)}
        >
          <span>Быстрые переходы</span>
          <b>{shortcuts.length}</b>
          <ChevronRight size={14} />
        </button>
        <div className="quick-panel-heading">
          <h2>{'Быстрый переход'}</h2>
        </div>
        <nav id={linksId} aria-label="Быстрые переходы администратора">
          {shortcuts.map(({ id, icon: Icon }) => {
            const section = adminSections.find((item) => item.id === id)!;
            return (
              <button
                key={section.id}
                className={section.id === 'registration' ? 'quick-nav-primary' : ''}
                aria-current={activeId === section.id ? 'page' : undefined}
                aria-label={persistent ? section.label : undefined}
                title={persistent ? section.label : undefined}
                onClick={() => {
                  setShortcutsExpanded(false);
                  onAction(section.id);
                }}
              >
                <span className="quick-nav-icon">
                  <Icon size={18} strokeWidth={1.7} />
                </span>
                <span>
                  <strong>{section.label}</strong>
                  <small>{section.caption}</small>
                </span>
                <ChevronRight size={15} />
              </button>
            );
          })}
        </nav>
        <div className="quick-card-note">
          <CreditCard size={19} />
          <strong>Клиент уже у стойки?</strong>
          <p>Найдите клиента по карте, ФИО или телефону в шапке и откройте его карточку.</p>
          <span>
            Демокарта <b>100001</b>
          </span>
        </div>
      </aside>
    </>
  );
  return persistent && smallViewport ? createPortal(panel, document.body) : panel;
}
