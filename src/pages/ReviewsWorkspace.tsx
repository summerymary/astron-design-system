import { useState } from 'react';
import type { Member } from '../types';
import { useWorkspace } from '../components/WorkspaceProvider';
import { SearchBox, Stats } from '../components/WorkspaceUI';
import { ReviewJournal } from '../components/ReviewJournal';
import { Field } from '../components/Field';
import { Select } from '../components/Select';
import { matchesSearch } from '../lib/directory-search';

export function ReviewsWorkspace({
  members,
  onMember,
}: {
  members: Member[];
  onMember: (member: Member) => void;
}) {
  const { data } = useWorkspace();
  const [query, setQuery] = useState(''),
    [rating, setRating] = useState('all');
  const rows = (data['client-reviews'] || []).filter(
    (r) =>
      (rating === 'all' || r.rating === rating) && matchesSearch(Object.values(r).join(' '), query),
  );
  return (
    <div className="ws-stack">
      <Stats
        items={[
          { label: 'Отзывов', value: rows.length },
          {
            label: 'Средняя оценка',
            value: rows.length ? rows.reduce((n, r) => n + Number(r.rating), 0) / rows.length : '—',
          },
        ]}
      />
      <section className="panel ws-panel">
        <div className="ws-toolbar">
          <SearchBox
            label="Поиск отзыва"
            value={query}
            onChange={setQuery}
            placeholder="Отзыв, клуб или сотрудник"
          />
          <Field label="Оценка">
            <Select value={rating} onChange={(e) => setRating(e.target.value)}>
              <option value="all">Все оценки</option>
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={String(n)}>
                  {n}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <ReviewJournal rows={rows} members={members} onMember={onMember} />
      </section>
    </div>
  );
}
