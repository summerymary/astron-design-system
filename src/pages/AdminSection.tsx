import { ArrowLeft, ArrowUpRight, CalendarDays, PanelRightOpen } from 'lucide-react';
import { Button } from '../components/ui';
import { adminSections } from '../data/admin';
import type { AdminSectionId } from '../data/admin';
import type { Member } from '../types';

export function AdminSection({
  section,
  member,
  onBack,
  onMembers,
}: {
  section: AdminSectionId;
  member: Member | null;
  onBack: () => void;
  onMembers: () => void;
}) {
  const info = adminSections.find((s) => s.id === section)!;
  return (
    <section className="panel admin-section-placeholder">
      <span className="section-preview-icon">
        {section === 'schedule' ? <CalendarDays size={30} /> : <PanelRightOpen size={30} />}
      </span>
      <span className="eyebrow">СЛЕДУЮЩИЙ ЭКРАН</span>
      <h2>{info.label}</h2>
      <p>Дизайн и функции этого раздела будут разработаны на следующем этапе.</p>
      {member && (
        <span className="section-member-context">
          Клиент: <strong>{member.name}</strong>
        </span>
      )}
      <div>
        <Button variant="secondary" onClick={onBack}>
          <ArrowLeft size={15} />
          На главную
        </Button>
        <Button onClick={onMembers}>
          Открыть клиентов
          <ArrowUpRight size={15} />
        </Button>
      </div>
    </section>
  );
}
