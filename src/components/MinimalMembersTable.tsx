import { ArrowDown } from 'lucide-react';
import type { Member } from '../types';
import { memberCards } from '../data/admin';
import { Badge } from './ui';
import { Status } from './WorkspaceUI';
import { MembershipTag } from './MembershipTag';

export function MinimalMembersTable({
  members,
  contacts,
  ascending,
  onSort,
  onMember,
}: {
  members: Member[];
  contacts: boolean;
  ascending: boolean;
  onSort: () => void;
  onMember: (member: Member) => void;
}) {
  return (
    <table className="minimal-members-table">
      <thead>
        <tr>
          <th>
            <button className="sort-button" onClick={onSort}>
              Клиент
              <ArrowDown
                size={13}
                style={{ transform: ascending ? undefined : 'rotate(180deg)' }}
              />
            </button>
          </th>
          {contacts ? (
            <>
              <th>Контакты</th>
              <th>Карта</th>
              <th>Статус</th>
            </>
          ) : (
            <>
              <th>Абонемент</th>
              <th>Состояние</th>
              <th>Действует до</th>
              <th>Визиты</th>
            </>
          )}
        </tr>
      </thead>
      <tbody>
        {members.map((member) => (
          <tr key={member.id}>
            <td>
              <button
                className="minimal-person-link"
                aria-label={member.name}
                onClick={() => onMember(member)}
              >
                <span>
                  <strong>{member.name}</strong>
                  {contacts ? (
                    member.tags && <small>{member.tags}</small>
                  ) : (
                    <small>{member.email}</small>
                  )}
                </span>
              </button>
            </td>
            {contacts ? (
              <>
                <td>
                  <span>{member.phone}</span>
                  <small>{member.email || 'Email не указан'}</small>
                </td>
                <td>
                  <code>{memberCards[member.id] || String(member.id + 99000)}</code>
                </td>
                <td>
                  <Status>{member.archived ? 'В архиве' : 'Активен'}</Status>
                </td>
              </>
            ) : (
              <>
                <td>
                  <MembershipTag name={member.plan} textOnly />
                </td>
                <td>
                  <Badge status={member.status} />
                </td>
                <td>{member.expires}</td>
                <td>{member.visits}</td>
              </>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
