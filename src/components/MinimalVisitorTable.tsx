import type { Member, Visit } from '../types';
import { demoClubs } from '../data/roles';
import { visitKinds } from '../data/admin';
import { TODAY } from '../data/workspace';
import { MembershipTag } from './MembershipTag';

export function MinimalVisitorTable({
  visits,
  members,
  onMember,
  currentClubId,
}: {
  visits: Visit[];
  members: Map<number, Member>;
  onMember: (member: Member) => void;
  currentClubId: string;
}) {
  const showClubs = visits.some((visit) => visit.clubId !== currentClubId);
  return (
    <table className="minimal-visitor-table">
      <thead>
        <tr>
          <th>Клиент</th>
          <th>Вход</th>
          <th>Посещение</th>
          <th>Абонемент</th>
        </tr>
      </thead>
      <tbody>
        {visits.map((visit) => {
          const member = members.get(visit.memberId)!;
          return (
            <tr key={visit.id}>
              <td>
                <button
                  className="minimal-person-link"
                  aria-label={member.name}
                  onClick={() => onMember(member)}
                >
                  <span>
                    <strong>{member.name}</strong>
                    <small aria-label={`Карта ${visit.card}`}>{visit.card}</small>
                  </span>
                </button>
              </td>
              <td>
                <time dateTime={visit.enteredAt}>{visit.enteredAt.slice(11)}</time>
                {visit.enteredAt.slice(0, 10) !== TODAY && (
                  <small>
                    {visit.enteredAt.slice(8, 10)}.{visit.enteredAt.slice(5, 7)}
                  </small>
                )}
              </td>
              <td>
                <span>{visitKinds[visit.kind]}</span>
                {showClubs && (
                  <small>{demoClubs.find((c) => c.id === visit.clubId)?.shortName}</small>
                )}
              </td>
              <td>
                <MembershipTag name={visit.plan} textOnly />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
