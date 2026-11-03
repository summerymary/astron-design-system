import { useState } from 'react';
import {
  CalendarDays,
  CreditCard,
  Sparkles,
  Users,
  ShoppingBag,
  Dumbbell,
  Wallet,
  ChevronRight,
  ContactRound,
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
  { id: 'collagen', icon: Dumbbell },
  { id: 'cash', icon: Wallet },
  { id: 'crm', icon: ContactRound },
] satisfies { id: AdminSectionId; icon: LucideIcon }[];
export function AdminQuickLinks({ onAction }: { onAction: (id: AdminSectionId) => void }) {
  const [shortcutsExpanded, setShortcutsExpanded] = useState(false);
  return (
    <aside className={`admin-quick-panel ${shortcutsExpanded ? 'shortcuts-open' : ''}`}>
      <button
        className="quick-mobile-toggle"
        aria-expanded={shortcutsExpanded}
        aria-controls="admin-quick-links"
        onClick={() => setShortcutsExpanded(!shortcutsExpanded)}
      >
        <span>Быстрые переходы</span>
        <b>{shortcuts.length}</b>
        <ChevronRight size={14} />
      </button>
      <div className="quick-panel-heading">
        <span className="eyebrow">ВСЕГДА ПОД РУКОЙ</span>
        <h2>Быстрый переход</h2>
      </div>
      <nav id="admin-quick-links" aria-label="Быстрые переходы администратора">
        {shortcuts.map(({ id, icon: Icon }) => {
          const section = adminSections.find((item) => item.id === id)!;
          return (
            <button
              key={section.id}
              className={section.id === 'registration' ? 'quick-nav-primary' : ''}
              onClick={() => onAction(section.id)}
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
        <p>Введите номер карты в шапке — откроется его карточка с доступными действиями.</p>
        <span>
          Демокарта <b>100001</b>
        </span>
      </div>
    </aside>
  );
}
