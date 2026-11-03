import { useState } from 'react';
import type { ClubBrand } from '../data/branding';

export function ClubLogo({
  brand,
  variant = 'wide',
  surface,
  decorative = false,
}: {
  brand: ClubBrand;
  variant?: 'wide' | 'compact';
  surface?: 'brand' | 'light' | 'dark';
  decorative?: boolean;
}) {
  const source = variant === 'compact' ? brand.markSrc : brand.logoSrc;
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const background = surface ?? (brand.logoTone === 'light' ? 'brand' : 'light');
  return (
    <span
      className={`club-logo logo-${variant} logo-surface-${background}${brand.logoFrameless && variant === 'wide' && !surface ? ' logo-frameless' : ''}`}
      style={
        background === 'brand' && brand.logoBackground
          ? { background: brand.logoBackground }
          : undefined
      }
      role={!decorative && (!source || failedSource === source) ? 'img' : undefined}
      aria-label={!decorative && (!source || failedSource === source) ? brand.name : undefined}
      aria-hidden={decorative || undefined}
    >
      {source && failedSource !== source ? (
        <img
          src={source}
          alt={decorative ? '' : brand.name}
          onError={() => setFailedSource(source)}
        />
      ) : (
        <span className="club-logo-fallback">
          {variant === 'compact' ? brand.initials : brand.name}
        </span>
      )}
    </span>
  );
}
