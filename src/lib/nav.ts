import {
  Building2,
  Contact,
  KeyRound,
  LayoutDashboard,
  Users,
  type LucideIcon,
} from 'lucide-react';

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const DASHBOARD_NAV: readonly NavItem[] = [
  { href: '/dashboard',           label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/entities',  label: 'Entities',  icon: Building2 },
  { href: '/dashboard/users',     label: 'Users',     icon: Users },
  { href: '/dashboard/employees', label: 'Employees', icon: Contact },
  { href: '/dashboard/roles',     label: 'Roles',     icon: KeyRound },
];
