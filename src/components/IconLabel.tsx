import type { LucideIcon } from 'lucide-react';

type Props = {
  icon: LucideIcon;
  children: React.ReactNode;
  className?: string;
};

/** Inline icon + label for buttons and links. */
export function IconLabel({ icon: Icon, children, className = 'inline-flex items-center gap-1.5' }: Props) {
  return (
    <span className={className}>
      <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden />
      {children}
    </span>
  );
}
