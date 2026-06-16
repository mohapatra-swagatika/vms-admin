'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { DASHBOARD_NAV } from '@/lib/nav';
import { useProfileImage } from '@/hooks/useProfileImage';
import ProfileMenu from '@/components/ProfileMenu';

export default function AppHeader() {
  const pathname = usePathname();
  const [user, setUser] = useState<{ id: string; name: string; email: string } | null>(null);
  const { url: profileImage, version: profileVersion, onUploaded } = useProfileImage();

  useEffect(() => {
    setUser(getUser());
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-white/95 backdrop-blur-sm border-b border-gray-200">
      <div className="h-full px-4 sm:px-6 flex items-center justify-between gap-4">
        <Link href="/dashboard" className="flex items-center gap-2.5 min-w-0 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white font-bold text-sm shrink-0">
            V
          </div>
          <div className="min-w-0 hidden sm:block">
            <div className="text-sm font-bold text-gray-900 leading-tight">VMS Admin</div>
            <div className="text-[10px] text-gray-400 leading-tight hidden md:block">Visitor Management</div>
          </div>
        </Link>

        <nav className="flex md:hidden flex-1 justify-center gap-0.5 overflow-x-auto px-1 scrollbar-none">
          {DASHBOARD_NAV.map(item => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                className={`shrink-0 px-2.5 py-1.5 rounded-lg transition-colors ${
                  pathname === item.href
                    ? 'bg-primary-muted text-primary'
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                <Icon className="w-5 h-5" aria-hidden />
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3 min-w-0 shrink-0">
          {user ? (
            <ProfileMenu
              user={user}
              profileImageUrl={profileImage}
              profileImageVersion={profileVersion}
              onProfileImageChange={onUploaded}
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gray-100 animate-pulse" />
          )}
        </div>
      </div>
    </header>
  );
}
