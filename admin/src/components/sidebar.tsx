'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Users, GraduationCap, Building2, BookOpen,
  Layers, CalendarRange, ClipboardCheck, AlertTriangle, Bell, BarChart3,
  ChevronLeft, Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';

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
  { href: '/design-system', label: 'Design System', icon: Sparkles },
];

/**
 * SEU sidebar — navy bg, gold logo accent, red active item with sliding
 * left border (Framer Motion `layoutId` animates the bar between items).
 *
 * Collapses to a 64px icon rail when the chevron is clicked.
 */
export function Sidebar() {
  const path = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 64 : 240 }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
      className="relative flex h-screen shrink-0 flex-col bg-sidebar text-sidebar-foreground"
    >
      {/* Logo / Title */}
      <div className={cn('flex h-16 items-center gap-3 border-b border-white/10 px-4', collapsed && 'justify-center')}>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-seu-red font-bold text-white shadow-md">
          SE
        </div>
        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.18 }}
              className="overflow-hidden"
            >
              <div className="text-sm font-semibold leading-tight">Smart Campus</div>
              <div className="text-[11px] leading-tight text-seu-gold">Saxony Egypt University</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-3">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === '/dashboard' ? path === '/dashboard' : path?.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'group relative flex items-center gap-3 overflow-hidden rounded-md px-3 py-2 text-sm transition-colors',
                active
                  ? 'bg-white/[0.06] text-white'
                  : 'text-white/70 hover:bg-white/[0.04] hover:text-white',
                collapsed && 'justify-center px-0',
              )}
              aria-current={active ? 'page' : undefined}
            >
              {active && (
                <motion.span
                  layoutId="sidebar-active-bar"
                  className="absolute left-0 top-1 bottom-1 w-1 rounded-r-md bg-seu-red"
                  transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                />
              )}
              {/* Hover background slide */}
              <span className="pointer-events-none absolute inset-0 -z-0 -translate-x-full bg-gradient-to-r from-white/0 via-white/[0.06] to-white/0 transition-transform duration-200 group-hover:translate-x-0" />
              <Icon className={cn('h-4 w-4 shrink-0 relative', active ? 'text-seu-gold' : 'text-white/70 group-hover:text-white')} />
              <AnimatePresence initial={false}>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.18 }}
                    className="relative truncate"
                  >
                    {label}
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="m-3 flex items-center justify-center gap-2 rounded-md border border-white/10 px-3 py-1.5 text-xs text-white/70 transition-colors hover:bg-white/[0.06] hover:text-white"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <motion.span animate={{ rotate: collapsed ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronLeft className="h-3.5 w-3.5" />
        </motion.span>
        {!collapsed && <span>Collapse</span>}
      </button>
    </motion.aside>
  );
}
