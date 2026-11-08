import { CalendarDays, Sparkles } from 'lucide-react';
import { SectionTitle } from '../components/ui';
import { roleHomes } from '../data/roles';
import type { DemoUser } from '../types';

export function RoleOverview({ user }: { user: DemoUser }) {
  const home = roleHomes[user.role];
  return (
    <div className="role-overview">
      <div className="role-metrics">
        {home.metrics.map((metric, index) => (
          <section className={`stat-card ${index === 0 ? 'stat-accent' : ''}`} key={metric.label}>
            <div className="stat-label">
              {metric.label}
              {index === 0 ? <Sparkles size={16} /> : <CalendarDays size={16} />}
            </div>
            <div className="role-metric-value">{metric.value}</div>
            <p>{metric.detail}</p>
          </section>
        ))}
      </div>
      <section className="panel role-items">
        <SectionTitle
          title={home.itemsTitle}
          subtitle={home.itemsCaption}
          action={<span className="count-badge">{home.items.length}</span>}
        />
        <div>
          {home.items.map((item) => (
            <div className="role-item" key={item.id}>
              <span className="role-item-time">{item.time}</span>
              <div className="role-item-copy">
                <strong>{item.title}</strong>
                <p>{item.subtitle}</p>
              </div>
              <span className="role-item-status">{item.status}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
