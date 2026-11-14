import { useId } from 'react';
import type { DemoSubscription } from '../data/clientProfile';
import { quantityLabel } from '../data/membership-kinds';
import { accessWindowLabel } from '../lib/registration';
import { MembershipTag } from './MembershipTag';

/** Only eligible passes belong here; unavailable passes are omitted by the caller. */
export function VisitPassList({
  passes,
  value,
  onChange,
  recommendedIds = [],
  categoryNames = {},
}: {
  passes: DemoSubscription[];
  value: string;
  onChange: (id: string) => void;
  recommendedIds?: string[];
  categoryNames?: Record<string, string>;
}) {
  const name = useId();
  return (
    <fieldset className="visit-pass-list" data-ui="visit-pass-list">
      <legend className="sr-only">Абонемент для посещения</legend>
      {passes.map((pass) => (
        <label key={pass.id} className={`visit-pass-row ${value === pass.id ? 'is-selected' : ''}`}>
          <input
            type="radio"
            name={name}
            value={pass.id}
            checked={value === pass.id}
            onChange={() => onChange(pass.id)}
          />
          <span className="visit-pass-description">
            <MembershipTag name={pass.name} kindId={pass.kindId} textOnly />
            <span className="visit-pass-meta">
              {pass.status === 'pending'
                ? 'Активируется при посещении'
                : pass.endsAt
                  ? `До ${pass.endsAt}`
                  : 'Действует'}
              {pass.trainerCategory && (
                <span>Категория: {categoryNames[pass.trainerCategory] || 'Тренер'}</span>
              )}
              {accessWindowLabel(pass) && <span>{accessWindowLabel(pass)}</span>}
              {pass.ageMin && pass.ageMax && (
                <span>
                  Возраст {pass.ageMin}–{pass.ageMax} лет
                </span>
              )}
            </span>
          </span>
          <span className="visit-pass-summary">
            <strong>
              {pass.remaining === null
                ? 'Безлимит'
                : `Осталось ${quantityLabel(pass.remaining, 'visit')}`}
            </strong>
            {recommendedIds.includes(pass.id) && (
              <span className="visit-pass-recommendation">Подходит к предзаписи</span>
            )}
          </span>
        </label>
      ))}
    </fieldset>
  );
}
