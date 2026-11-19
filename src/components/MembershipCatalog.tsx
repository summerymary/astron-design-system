import { useId, useRef, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import type { DemoRecord } from '../data/workspace';
import type { PlanSectionId } from '../lib/sale-catalog';
import { catalogGroups, catalogPlacement, sortCatalogPlans } from '../lib/membership-catalog';
import { Empty, NavigationCard } from './WorkspaceUI';
import { Button } from './ui';

export function MembershipCatalog({
  section,
  plans,
  searching = false,
  showEmpty = false,
  renderPlans,
  onCreate,
  scopeLabel,
}: {
  section: PlanSectionId;
  plans: DemoRecord[];
  searching?: boolean;
  showEmpty?: boolean;
  renderPlans: (plans: DemoRecord[]) => ReactNode;
  onCreate?: (familyId: string) => void;
  scopeLabel?: string;
}) {
  const [groupId, setGroupId] = useState('');
  const [familyId, setFamilyId] = useState('');
  const title = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  const rowsFor = (id: string) =>
    sortCatalogPlans(plans.filter((plan) => catalogPlacement(plan, section).family.id === id));
  const groups = catalogGroups(section).filter(
    (group) =>
      (showEmpty && !group.id.endsWith('-other')) ||
      group.families.some((family) => rowsFor(family.id).length),
  );
  const group = groups.find((group) => group.id === groupId);
  const family = group?.families.find((family) => family.id === familyId);
  const visibleFamilies =
    group?.families.filter((family) => showEmpty || rowsFor(family.id).length) || [];
  const move = (nextGroup: string, nextFamily = '') => {
    setGroupId(nextGroup);
    setFamilyId(nextFamily);
    requestAnimationFrame(() => title.current?.focus({ preventScroll: true }));
  };
  const searchFamilies = groups.flatMap((group) =>
    group.families.flatMap((family) => {
      const rows = rowsFor(family.id);
      return rows.length ? [{ group, family, rows }] : [];
    }),
  );
  const heading =
    scopeLabel ||
    (searching
      ? searchFamilies.length === 1
        ? `${searchFamilies[0].group.name} / ${searchFamilies[0].family.name}`
        : 'Результаты по группам'
      : family?.name || group?.name || 'Группы абонементов');
  return (
    <section
      className="membership-browser ws-stack"
      data-ui="membership-catalog"
      aria-labelledby={titleId}
    >
      <div className="membership-browser-heading">
        <h3 id={titleId} tabIndex={-1} ref={title}>
          {heading}
        </h3>
        {!scopeLabel && !searching && group && (
          <Button
            variant="ghost"
            className="membership-browser-back"
            aria-label={family && visibleFamilies.length > 1 ? 'К подгруппам' : 'К группам'}
            onClick={() => move(family && visibleFamilies.length > 1 ? group.id : '')}
          >
            <ArrowLeft size={18} aria-hidden="true" />
            <span>{family && visibleFamilies.length > 1 ? 'К подгруппам' : 'К группам'}</span>
          </Button>
        )}
      </div>
      {!plans.length && (searching || scopeLabel) ? (
        <Empty
          title="Абонементы не найдены"
          text="Измените название, группу или подгруппу в поиске."
        />
      ) : scopeLabel ? (
        renderPlans(sortCatalogPlans(plans))
      ) : searching ? (
        searchFamilies.map(({ group, family, rows }) => (
          <section className="ws-stack" key={family.id}>
            {searchFamilies.length > 1 && (
              <h4>
                {group.name} / {family.name}
              </h4>
            )}
            {renderPlans(rows)}
          </section>
        ))
      ) : family ? (
        rowsFor(family.id).length ? (
          renderPlans(rowsFor(family.id))
        ) : (
          <Empty
            title="В подгруппе пока нет тарифов"
            text="Добавьте абонемент и задайте его условия."
            action={
              onCreate && <Button onClick={() => onCreate(family.id)}>Добавить абонемент</Button>
            }
          />
        )
      ) : (
        <div className="membership-browser-grid">
          {group
            ? visibleFamilies.map((family) => (
                <NavigationCard
                  key={family.id}
                  title={family.name}
                  caption={`${rowsFor(family.id).length ? `Тарифов: ${rowsFor(family.id).length}` : 'Тарифов пока нет'} · срок и посещения внутри`}
                  onClick={() => move(group.id, family.id)}
                />
              ))
            : groups.map((group) => (
                <NavigationCard
                  key={group.id}
                  title={group.name}
                  caption={
                    <>
                      {group.description}
                      <br />
                      Тарифов:{' '}
                      {group.families.reduce((sum, family) => sum + rowsFor(family.id).length, 0)}
                    </>
                  }
                  onClick={() => {
                    const families = group.families.filter(
                      (family) => showEmpty || rowsFor(family.id).length,
                    );
                    move(group.id, families.length === 1 ? families[0].id : '');
                  }}
                />
              ))}
        </div>
      )}
    </section>
  );
}
