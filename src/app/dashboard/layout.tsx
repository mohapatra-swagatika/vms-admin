'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { clearAuth, getUser, setPermissions } from '@/lib/auth';
import AppHeader from '@/components/AppHeader';
import { DASHBOARD_NAV } from '@/lib/nav';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('vms_token');
    if (!token) { router.replace('/login'); return; }
    setUser(getUser());
    api.getPermissions()
      .then((perms: { allowed?: string[] }) => {
        if (perms.allowed) setPermissions(perms.allowed);
      })
      .catch(() => { /* keep cached permissions from login */ });
  }, [router]);

  function logout() {
    clearAuth();
    router.replace('/login');
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <AppHeader />

      <div className="flex flex-1 min-h-0 pt-14">
      {/* Sidebar */}
      <aside className="hidden md:flex w-56 bg-white border-r border-gray-200 flex-col shrink-0">
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {DASHBOARD_NAV.map(item => (
            <Link
              key={item.href} href={item.href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                pathname === item.href
                  ? 'bg-primary-muted text-primary font-medium'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="px-4 py-4 border-t border-gray-100">
          {user && (
            <div className="mb-3 px-2">
              <div className="text-xs font-semibold text-gray-800 truncate">{user.name}</div>
              <div className="text-xs text-gray-400 truncate">{user.email}</div>
            </div>
          )}
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-danger hover:bg-danger-hover rounded-lg transition-colors"
          >
            <span className="text-base leading-none">⏻</span>
            Logout
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
