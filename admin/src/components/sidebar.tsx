'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-store';
import {
  LayoutDashboard, Users, GraduationCap, Building2, BookOpen,
  Layers, CalendarRange, ClipboardCheck, AlertTriangle, Bell, BarChart3, LogOut,
} from 'lucide-react';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/students', label: 'Students', icon: Users },
  { href: '/doctors', label: 'Doctors', icon: GraduationCap },
  { href: '/rooms', label: 'Rooms', icon: Building2 },
  { href: '/subjects', label: 'Subjects', icon: BookOpen },
  { href: '/sections', label: 'Sections', icon: Layers },
  { href: '/schedule', label: 'Schedule', icon: CalendarRange },
  { href: '/attendance', label: 'Attendance', icon: ClipboardCheck },
  { href: '/at-risk', label: 'At-Risk', icon: AlertTriangle },
  { href: '/notifications', label: 'Notifications', icon: Bell },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
];

export function Sidebar() {
  const path = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-border bg-card">
      <div className="flex h-16 items-center gap-2 border-b border-border px-6 font-semibold">
        <div className="h-8 w-8 rounded bg-primary text-primary-foreground grid place-items-center">SE</div>
        Smart Campus
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = path?.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                active ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border p-3 text-sm">
        {user && <div className="mb-2 truncate text-muted-foreground">{user.email}</div>}
        <button
          onClick={async () => {
            await logout();
            router.push('/login');
          }}
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 hover:bg-muted"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </button>
      </div>
    </aside>
  );
}
