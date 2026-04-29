import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  UtensilsCrossed,
  MapPin,
  Users,
  Tag,
  LogOut,
  ChefHat,
  ClipboardList,
} from 'lucide-react';
import { useStaffAuth } from '@shared/context/StaffAuthContext';
import { useFetch } from '@shared/hooks/useFetch';

const adminNav = [
  { to: '/staff/admin', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/staff/admin/menu', icon: UtensilsCrossed, label: 'Menu' },
  { to: '/staff/admin/locations', icon: MapPin, label: 'Locations' },
  { to: '/staff/admin/users', icon: Users, label: 'Users' },
  { to: '/staff/admin/promotions', icon: Tag, label: 'Promotions' },
];

const kitchenNav = [
  { to: '/staff/kitchen', icon: ChefHat, label: 'Orders', end: true },
  { to: '/staff/kitchen/history', icon: ClipboardList, label: 'History' },
];

export default function StaffLayout() {
  const { user, token, logout } = useStaffAuth();
  const navigate = useNavigate();
  const { data: locations } = useFetch('/locations', token);
  const locationName = user?.location_id
    ? (locations || []).find((l) => l.id === user.location_id)?.name
    : null;

  const navItems = user?.role === 'admin' ? adminNav : kitchenNav;

  function handleLogout() {
    logout();
    navigate('/staff/login');
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 border-r border-border bg-surface flex flex-col">
        <div className="flex items-center gap-2 px-4 h-16 border-b border-border">
          <img
            src="/icon_main.png"
            alt=""
            aria-hidden="true"
            className="h-9 w-9 rounded-lg object-cover shadow-sm"
          />
          <div>
            <p className="text-sm font-bold text-primary-dark leading-tight">The Rollecito</p>
            <p className="text-[10px] uppercase tracking-wider text-text-secondary">Staff</p>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-0.5">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary-light text-primary-dark'
                    : 'text-text-secondary hover:bg-gray-50 hover:text-text'
                }`
              }
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-border p-3">
          <div className="mb-2 px-3">
            <p className="text-sm font-medium text-text truncate">
              {user?.first_name} {user?.last_name}
            </p>
            <p className="text-xs text-text-secondary capitalize">{user?.role}</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-text-secondary hover:bg-red-50 hover:text-error transition-colors"
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-border bg-surface flex items-center justify-between px-6">
          <h1 className="text-lg font-semibold text-text">
            {user?.role === 'admin' ? 'Admin Panel' : 'Kitchen'}
          </h1>
          {locationName && (
            <div className="flex items-center gap-1.5 rounded-lg bg-primary-light/50 px-3 py-1.5 text-sm font-medium text-primary-dark">
              <MapPin size={14} />
              {locationName}
            </div>
          )}
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
