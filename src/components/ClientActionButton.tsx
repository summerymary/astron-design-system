import type { ButtonHTMLAttributes } from 'react';
import { CalendarPlus, ContactRound, LogIn, ShoppingBag } from 'lucide-react';
import { Button } from './ui';

const clientActions = {
  book: { label: 'Записать', icon: CalendarPlus, variant: 'secondary' },
  visit: { label: 'Отметить посещение', icon: LogIn, variant: 'accent' },
  sell: { label: 'Продать', icon: ShoppingBag, variant: 'primary' },
  profile: { label: 'Карточка клиента', icon: ContactRound, variant: 'secondary' },
} as const;

export function ClientActionButton({
  action,
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  action: keyof typeof clientActions;
}) {
  const { label, icon: Icon, variant } = clientActions[action];
  return (
    <Button {...props} variant={variant} data-client-action={action}>
      <Icon size={20} aria-hidden="true" />
      <span>{label}</span>
    </Button>
  );
}
