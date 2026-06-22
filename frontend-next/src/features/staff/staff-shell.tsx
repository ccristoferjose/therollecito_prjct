'use client';

import { useEffect, type ComponentType } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, UtensilsCrossed, MapPin, Users, Tag, LogOut, ChefHat, ClipboardList,
} from 'lucide-react';
import { useStaffAuth } from '@/providers/staff-auth-provider';
import { useFetch } from '@/lib/hooks/use-fetch';
import Spinner from '@/components/ui/spinner';
import { cn } from '@/lib/utils/cn';
import type { Location } from '@/lib/types';

interface NavItem {
  to: string;
  icon: ComponentType<{ size?: number }>;
  label: string;
  end?: boolean;
}

const adminNav: NavItem[] = [
  { to: '/staff/admin', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/staff/admin/menu', icon: UtensilsCrossed, label: 'Menu' },
  { to: '/staff/admin/locations', icon: MapPin, label: 'Locations' },
  { to: '/staff/admin/users', icon: Users, label: 'Users' },
  { to: '/staff/admin/promotions', icon: Tag, label: 'Promotions' },
];

const kitchenNav: NavItem[] = [
  { to: '/staff/kitchen', icon: ChefHat, label: 'Orders', end: true },
  { to: '/staff/kitchen/history', icon: ClipboardList, label: 'History' },
];

function FullScreenSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Spinner size="lg" />
    </div>
  );
}

export default function StaffShell({ children }: { children: React.ReactNode }) {
  const { user, token, logout, isAuthenticated, hydrated } = useStaffAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { data: locations } = useFetch<Location[]>(token ? '/locations' : null, token);

  const isAdminArea = pathname?.startsWith('/staff/admin') ?? false;
  const wrongRole = isAdminArea && user?.role !== 'admin';

  // Route guard — only act once localStorage auth has been restored.
  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthenticated) router.replace('/staff/login');
    else if (wrongRole) router.replace('/staff/kitchen');
  }, [hydrated, isAuthenticated, wrongRole, router]);

  if (!hydrated || !isAuthenticated || wrongRole) return <FullScreenSpinner />;

  const locationName = user?.location_id
    ? (locations || []).find((l) => l.id === user.location_id)?.name
    : null;
  const navItems = user?.role === 'admin' ? adminNav : kitchenNav;

  const handleLogout = () => {
    logout();
    router.push('/staff/login');
  };

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-surface">
        <div className="flex h-16 items-center gap-2 border-b border-border px-4">
          <Image src="/icon_main.png" alt="" aria-hidden width={36} height={36} className="h-9 w-9 rounded-lg object-cover shadow-sm" />
          <div>
            <p className="text-sm font-bold leading-tight text-primary-dark">The Rollecito</p>
            <p className="text-[10px] uppercase tracking-wider text-text-secondary">Staff</p>
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 p-3">
          {navItems.map((item) => {
            const active = item.end ? pathname === item.to : pathname?.startsWith(item.to);
            return (
              <Link
                key={item.to}
                href={item.to}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  active ? 'bg-primary-light text-primary-dark' : 'text-text-secondary hover:bg-gray-50 hover:text-text',
                )}
              >
                <item.icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border p-3">
          <div className="mb-2 px-3">
            <p className="truncate text-sm font-medium text-text">
              {user?.first_name} {user?.last_name}
            </p>
            <p className="text-xs capitalize text-text-secondary">{user?.role}</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-red-50 hover:text-error"
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-border bg-surface px-6">
          <h1 className="text-lg font-semibold text-text">{user?.role === 'admin' ? 'Admin Panel' : 'Kitchen'}</h1>
          {locationName && (
            <div className="flex items-center gap-1.5 rounded-lg bg-primary-light/50 px-3 py-1.5 text-sm font-medium text-primary-dark">
              <MapPin size={14} />
              {locationName}
            </div>
          )}
        </header>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
