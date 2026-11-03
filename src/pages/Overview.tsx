import { useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  ChevronRight,
  Clock3,
  ScanLine,
  Users,
  Wallet,
} from 'lucide-react';
import { classes, weeklyVisits } from '../data/mock';
import type { Member } from '../types';
import { Avatar, Badge, SectionTitle, TextLink } from '../components/ui';

export function Overview({
  members,
  onMembers,
  onMember,
  onClass,
}: {
  members: Member[];
  onMembers: () => void;
  onMember: (m: Member) => void;
  onClass: (index: number) => void;
}) {
  const [period, setPeriod] = useState<'week' | 'month'>('week');
  const [bar, setBar] = useState<number | null>(null);
  const visits =
    period === 'week'
      ? weeklyVisits
      : weeklyVisits.map((v, i) => ({ day: `${i * 4 + 1}–${i * 4 + 4}`, value: v.value * 4 + 14 }));
  const total = visits.reduce((sum, item) => sum + item.value, 0);
  return (
    <>
      <div className="stats-grid">
        <div className="stat-card stat-accent">
          <div className="stat-label">
            Активные клиенты
            <Users size={18} />
          </div>
          <div className="stat-value">
            {1248 + members.length - 6}
            <span>чел.</span>
          </div>
          <div className="stat-foot">
            <span className="trend">
              <ArrowUpRight size={14} /> 12,8%
            </span>
            <span>за этот месяц</span>
          </div>
          <div className="stat-decoration" />
        </div>
        <div className="stat-card">
          <div className="stat-label">
            Посещения сегодня
            <ScanLine size={18} />
          </div>
          <div className="stat-value">
            142<span>визита</span>
          </div>
          <div className="stat-foot">
            <span className="trend">
              <ArrowUpRight size={14} /> 8,4%
            </span>
            <span>к прошлому воскресенью</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">
            Выручка за месяц
            <Wallet size={18} />
          </div>
          <div className="stat-value">
            842 500<span>₽</span>
          </div>
          <div className="stat-foot">
            <span className="trend">
              <ArrowUpRight size={14} /> 16,2%
            </span>
            <span>к прошлому месяцу</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">
            Загрузка клуба
            <Clock3 size={18} />
          </div>
          <div className="stat-value">
            64<span>%</span>
          </div>
          <div className="stat-foot">
            <span className="trend trend-neutral">
              <ArrowDownRight size={14} /> 4,1%
            </span>
            <span>сейчас в зале 32 человека</span>
          </div>
        </div>
      </div>

      <div className="overview-grid">
        <section className="panel attendance-panel">
          <SectionTitle
            title="Ритм клуба"
            subtitle="Посещения за период"
            action={
              <div className="small-segment" aria-label="Период посещений">
                {(['week', 'month'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => {
                      setPeriod(p);
                      setBar(null);
                    }}
                    aria-pressed={period === p}
                    className={period === p ? 'selected' : ''}
                  >
                    {p === 'week' ? 'Неделя' : 'Месяц'}
                  </button>
                ))}
              </div>
            }
          />
          <div className="chart-summary">
            <strong>{total.toLocaleString('ru-RU')}</strong>
            <span>посещений</span>
            <span className="chart-growth">
              <ArrowUpRight size={14} /> 9,6%
            </span>
          </div>
          <div className="bar-chart">
            <div className="chart-grid">
              {[200, 150, 100, 50, 0].map((n) => (
                <div key={n}>
                  <span>{period === 'week' ? n : n * 4}</span>
                  <i />
                </div>
              ))}
            </div>
            <div className="chart-columns">
              {visits.map((item, i) => (
                <button
                  className={`chart-column ${i === 6 ? 'current' : ''}`}
                  style={
                    {
                      '--bar-height': `${(item.value / (period === 'week' ? 200 : 800)) * 100}%`,
                    } as React.CSSProperties
                  }
                  key={item.day}
                  onMouseEnter={() => setBar(i)}
                  onMouseLeave={() => setBar(null)}
                  onFocus={() => setBar(i)}
                  onBlur={() => setBar(null)}
                  aria-label={`${item.day}: ${item.value} посещений`}
                >
                  <span className="bar-track">
                    <span className="bar-fill" />
                    {bar === i && <span className="bar-tooltip">{item.value} визитов</span>}
                  </span>
                  <span className="bar-label">{item.day}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="chart-caption">
            <span>
              <i />
              Посещения
            </span>
            <span>{period === 'week' ? '26 октября — 1 ноября' : '1 — 28 октября'} 2026</span>
          </div>
        </section>

        <section className="panel schedule-panel">
          <SectionTitle title="Занятия сегодня" action={<span className="count-badge">3</span>} />
          <p className="panel-subtitle">Воскресенье, 1 ноября</p>
          <div className="class-list">
            {classes.map((item, index) => (
              <button className="class-item" key={item.time} onClick={() => onClass(index)}>
                <div className="class-time">
                  <strong>{item.time}</strong>
                  <span>{item.duration}</span>
                </div>
                <div className={`class-marker marker-${item.color}`} />
                <div className="class-info">
                  <strong>{item.name}</strong>
                  <span>{item.trainer}</span>
                  <div className="class-meta">
                    <span>{item.room}</span>
                    <span className={item.booked === item.capacity ? 'is-full' : ''}>
                      <Users size={12} />
                      {item.booked}/{item.capacity}
                    </span>
                  </div>
                </div>
                <ChevronRight size={16} />
              </button>
            ))}
          </div>
          <div className="schedule-note">
            <CalendarDays size={15} />
            <span>Всё идёт по плану. Хорошего дня!</span>
          </div>
        </section>
      </div>

      <section className="panel members-preview">
        <SectionTitle
          title="Клиенты клуба"
          subtitle="Небольшая часть вашей команды движения"
          action={<TextLink onClick={onMembers}>Все клиенты</TextLink>}
        />
        <div className="table-scroll">
          <table className="members-table">
            <thead>
              <tr>
                <th>Клиент</th>
                <th>Абонемент</th>
                <th>Статус</th>
                <th>Действует до</th>
                <th>
                  <span className="sr-only">Открыть</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {members.slice(0, 3).map((m) => (
                <tr key={m.id}>
                  <td>
                    <button className="member-name-button" onClick={() => onMember(m)}>
                      <Avatar member={m} />
                      <span>
                        <strong>{m.name}</strong>
                        <small>#{m.id}</small>
                      </span>
                    </button>
                  </td>
                  <td>{m.plan}</td>
                  <td>
                    <Badge status={m.status} />
                  </td>
                  <td className="date-cell">{m.expires}</td>
                  <td>
                    <button
                      className="icon-button"
                      aria-label={`Открыть: ${m.name}`}
                      onClick={() => onMember(m)}
                    >
                      <ArrowUpRight size={17} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mobile-member-list">
          {members.slice(0, 3).map((m) => (
            <button key={m.id} className="mobile-member" onClick={() => onMember(m)}>
              <Avatar member={m} />
              <span>
                <strong>{m.name}</strong>
                <small>{m.plan}</small>
              </span>
              <Badge status={m.status} />
            </button>
          ))}
        </div>
      </section>
      <div className="prototype-footnote">
        <span className="live-dot" />
        Демонстрационные данные<span>Обновлено сегодня в 09:41</span>
      </div>
    </>
  );
}
