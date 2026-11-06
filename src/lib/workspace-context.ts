import { createContext } from 'react';
import type { DemoRecord } from '../data/workspace';

export type WorkspaceState = {
  data: Record<string, DemoRecord[]>;
  put: (collection: string, record: DemoRecord) => void;
  remove: (collection: string, id: string) => void;
  reset: () => void;
  barOpen: boolean;
  setBarOpen: (open: boolean) => void;
};
// Keep the context identity separate from the refreshed component module.
export const WorkspaceContext = createContext<WorkspaceState | null>(null);
