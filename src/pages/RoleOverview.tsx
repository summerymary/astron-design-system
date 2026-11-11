import { Stats } from '../components/WorkspaceUI';
import { CountBadge, SectionTitle, StatusBadge } from '../components/ui';
import { roleHomes } from '../data/roles';
import type { DemoUser } from '../types';

export function RoleOverview({ user }: { user: DemoUser }) {
  const home = roleHomes[user.role];
  return (
    <div className="role-overview">
      <Stats
        items={home.metrics.map((metric) => ({
          label: metric.label,
          value: metric.value,
          note: metric.detail,
        }))}
      />
      <section className="panel role-items">
        <SectionTitle
          title={home.itemsTitle}
          subtitle={home.itemsCaption}
          action={<CountBadge>{home.items.length}</CountBadge>}
        />
        <div className="home-records" role="region" aria-label={home.itemsTitle} tabIndex={0}>
          {home.items.map((item) => (
            <div className="role-item" key={item.id}>
              <span className="role-item-time">{item.time}</span>
              <div className="role-item-copy">
                <strong>{item.title}</strong>
                <p>{item.subtitle}</p>
              </div>
              <StatusBadge>{item.status}</StatusBadge>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
