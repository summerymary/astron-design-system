import { useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { DemoRecord } from '../data/workspace';
import type { PlanSectionId } from '../lib/sale-catalog';
import { catalogGroups, catalogPlacement, sortCatalogPlans } from '../lib/membership-catalog';
import { Back, Empty, NavigationCard } from './WorkspaceUI';
import { Button } from './ui';

export function MembershipCatalog({
  section,
  plans,
  searching = false,
  showEmpty = false,
  renderPlans,
  onCreate,
}: {
  section: PlanSectionId;
  plans: DemoRecord[];
  searching?: boolean;
  showEmpty?: boolean;
  renderPlans: (plans: DemoRecord[]) => ReactNode;
  onCreate?: (familyId: string) => void;
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
    requestAnimationFrame(() => title.current?.focus());
  };
  return (
    <section
      className="membership-browser ws-stack"
      data-ui="membership-catalog"
      aria-labelledby={titleId}
    >
      <div className="membership-browser-heading">
        <h3 id={titleId} tabIndex={-1} ref={title}>
          {searching
            ? 'Результаты по группам'
            : family?.name || group?.name || 'Группы абонементов'}
        </h3>
        {!searching && group && (
          <Back onClick={() => move(family && visibleFamilies.length > 1 ? group.id : '')}>
            {family && visibleFamilies.length > 1 ? 'К подгруппам' : 'К группам'}
          </Back>
        )}
      </div>
      {!searching && group && (
        <p className="membership-browser-path">
          {group.name}
          {family ? ` / ${family.name}` : ''}
        </p>
      )}
      {searching && !plans.length ? (
        <Empty
          title="Абонементы не найдены"
          text="Измените название, группу или подгруппу в поиске."
        />
      ) : searching ? (
        groups.map((group) =>
          group.families.map((family) => {
            const rows = rowsFor(family.id);
            return rows.length ? (
              <section className="ws-stack" key={family.id}>
                <h4>
                  {group.name} / {family.name}
                </h4>
                {renderPlans(rows)}
              </section>
            ) : null;
          }),
        )
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
