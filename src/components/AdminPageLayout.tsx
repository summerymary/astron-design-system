import type { ReactNode } from 'react';
import type { AdminSectionId } from '../data/admin';
import { AdminQuickLinks } from './AdminQuickLinks';

export function AdminPageLayout({
  enabled,
  children,
  onAction,
  activeId,
  pageKey,
  mobileMode,
  mobileOpen,
  onMobileOpenChange,
  onAllSections,
}: {
  enabled: boolean;
  children: ReactNode;
  onAction: (id: AdminSectionId) => void;
  activeId?: AdminSectionId;
  pageKey: string;
  mobileMode?: boolean;
  mobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
  onAllSections?: () => void;
}) {
  if (!enabled) return children;
  return (
    <div className="admin-page-layout">
      <div className="admin-page-main">{children}</div>
      <AdminQuickLinks
        onAction={onAction}
        persistent
        activeId={activeId}
        pageKey={pageKey}
        mobileMode={mobileMode}
        mobileOpen={mobileOpen}
        onMobileOpenChange={onMobileOpenChange}
        onAllSections={onAllSections}
      />
    </div>
  );
}
