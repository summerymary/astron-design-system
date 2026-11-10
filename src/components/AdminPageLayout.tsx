import type { ReactNode } from 'react';

/** A full-width administrator workspace; actions live in the header and left navigation. */
export function AdminPageLayout({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  if (!enabled) return children;
  return (
    <div className="admin-page-layout">
      <div className="admin-page-main">{children}</div>
    </div>
  );
}
