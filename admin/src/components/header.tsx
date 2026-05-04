'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, LogOut, Search, User as UserIcon } from 'lucide-react';
import { useAuth } from '@/lib/auth-store';
import { Input } from '@/components/ui';
import { cn } from '@/lib/utils';

/**
 * Top header bar — search, notifications bell with unread count, admin avatar
 * dropdown with logout. Sticky on top of every authenticated page.
 */
export function Header() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const initial = (user?.email ?? 'A').slice(0, 1).toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border bg-card/80 px-6 backdrop-blur">
      <div className="relative max-w-md flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search students, doctors, sections…"
          className="h-10 pl-9"
          aria-label="Global search"
        />
      </div>
      <div className="flex items-center gap-2">
        <button
          aria-label="Notifications"
          onClick={() => router.push('/notifications')}
          className="relative inline-flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Bell className="h-5 w-5" />
          {/* In a real app, bind to unread count */}
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-seu-red" />
        </button>

        <div className="relative">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-2 rounded-md p-1 pr-3 transition-colors hover:bg-muted"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-seu-navy text-sm font-semibold text-white">
              {initial}
            </span>
            <span className="text-sm font-medium hidden sm:block max-w-[16ch] truncate">{user?.email ?? 'admin'}</span>
          </button>

          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.96 }}
                transition={{ duration: 0.15 }}
                className={cn(
                  'absolute right-0 top-full mt-2 w-48 rounded-md border border-border bg-card p-1 text-sm shadow-card-lift',
                )}
                onMouseLeave={() => setMenuOpen(false)}
                role="menu"
              >
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    router.push('/dashboard');
                  }}
                  className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left hover:bg-muted"
                  role="menuitem"
                >
                  <UserIcon className="h-4 w-4" /> My account
                </button>
                <button
                  onClick={async () => {
                    setMenuOpen(false);
                    await logout();
                    router.push('/login');
                  }}
                  className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-seu-red hover:bg-seu-red/10"
                  role="menuitem"
                >
                  <LogOut className="h-4 w-4" /> Logout
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
