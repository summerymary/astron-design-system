import { useContext, useState } from 'react';
import type { ReactNode } from 'react';
import { createWorkspaceData } from '../data/workspace';
import type { DemoRecord } from '../data/workspace';
import { WorkspaceContext as Context } from '../lib/workspace-context';
import { reserveSeatNotification } from '../lib/schedule-attendance';
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState(createWorkspaceData);
  const [barOpen, setBarOpen] = useState(false);
  const put = (collection: string, record: DemoRecord) =>
    setData((previous) => {
      const notice =
        collection === 'events'
          ? reserveSeatNotification(
              previous.events.find((row) => row.id === record.id),
              record,
              (previous.notifications || []).filter(
                (row) => row.eventId === record.id && row.type === 'Резерв',
              ).length + 1,
            )
          : null;
      return {
        ...previous,
        [collection]: previous[collection]?.some((row) => row.id === record.id)
          ? previous[collection].map((row) => (row.id === record.id ? record : row))
          : [...(previous[collection] ?? []), record],
        ...(notice ? { notifications: [...(previous.notifications || []), notice] } : {}),
      };
    });
  const remove = (collection: string, id: string) =>
    setData((previous) => ({
      ...previous,
      [collection]: previous[collection].filter((row) => row.id !== id),
    }));
  return (
    <Context.Provider
      value={{
        data,
        put,
        remove,
        barOpen,
        setBarOpen,
        reset: () => {
          setData(createWorkspaceData());
          setBarOpen(false);
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useWorkspace() {
  const value = useContext(Context);
  if (!value) throw new Error('WorkspaceProvider is required');
  return value;
}
export function demoId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}
