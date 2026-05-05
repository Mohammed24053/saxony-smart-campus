'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, LogOut, Search, User as UserIcon, Rows3, Rows4, Languages, Moon, Sun } from 'lucide-react';
import { useAuth } from '@/lib/auth-store';
import { Input } from '@/components/ui';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n/i18n';
import { useTheme } from '@/components/theme-provider';

/**
 * Top header bar (round 2 — Linear-style 56px dense).
 *
 * - 56px tall (CSS var --density-header)
 * - global search left, density toggle + bell + user avatar right
 * - density toggle persists in localStorage and toggles `data-density="compact"` on <html>
 */
export function Header() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [compact, setCompact] = useState(false);
  const { t, locale, setLocale } = useT();
  const theme = useTheme((s) => s.theme);
  const toggleTheme = useTheme((s) => s.toggleTheme);

  // Read persisted density preference once on mount.
  useEffect(() => {
    const v = typeof window !== 'undefined' ? localStorage.getItem('density') : null;
    if (v === 'compact') {
      setCompact(true);
      document.documentElement.dataset.density = 'compact';
    }
  }, []);

  function toggleDensity() {
    setCompact((c) => {
      const next = !c;
      if (typeof window !== 'undefined') {
        if (next) {
          document.documentElement.dataset.density = 'compact';
          localStorage.setItem('density', 'compact');
        } else {
          delete document.documentElement.dataset.density;
          localStorage.removeItem('density');
        }
      }
      return next;
    });
  }

  const initial = (user?.email ?? 'A').slice(0, 1).toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex h-header items-center gap-3 border-b border-border bg-card/85 px-4 backdrop-blur">
      <div className="relative max-w-md flex-1">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder={t('common.search')}
          onFocus={() => {
            const ev = new KeyboardEvent('keydown', { key: 'k', metaKey: true });
            window.dispatchEvent(ev);
          }}
          readOnly
          className="h-8 pl-8 text-[13px]"
          aria-label="Global search"
        />
        <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border border-border bg-muted px-1 py-px font-mono text-[10px] text-muted-foreground sm:inline-block">
          ⌘K
        </kbd>
      </div>
      <div className="flex items-center gap-1">
        <button
          aria-label={locale === 'ar' ? 'Switch to English' : 'الترجمة العربية'}
          onClick={() => setLocale(locale === 'ar' ? 'en' : 'ar')}
          title={locale === 'ar' ? 'EN' : 'AR'}
          className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Languages className="h-3.5 w-3.5" />
          <span className="font-mono">{locale.toUpperCase()}</span>
        </button>
        <button
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
        <button
          aria-label={compact ? 'Comfortable density' : 'Compact density'}
          onClick={toggleDensity}
          title={compact ? 'Switch to comfortable density' : 'Switch to compact density'}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {compact ? <Rows3 className="h-4 w-4" /> : <Rows4 className="h-4 w-4" />}
        </button>
        <button
          aria-label="Notifications"
          onClick={() => router.push('/notifications')}
          className="relative inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Bell className="h-4 w-4" />
          {/* In a real app, bind to unread count */}
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-seu-red" />
        </button>

        <div className="relative">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="flex h-8 items-center gap-1.5 rounded-md px-1 pr-2 transition-colors hover:bg-muted"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-seu-navy text-[11px] font-semibold text-white">
              {initial}
            </span>
            <span className="text-xs font-medium hidden sm:block max-w-[14ch] truncate">
              {user?.email ?? 'admin'}
            </span>
          </button>

          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.96 }}
                transition={{ duration: 0.15 }}
                className={cn(
                  'absolute right-0 top-full mt-2 w-44 rounded-md border border-border bg-card p-1 text-sm shadow-card-lift',
                )}
                onMouseLeave={() => setMenuOpen(false)}
                role="menu"
              >
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    router.push('/profile');
                  }}
                  className="flex w-full items-center gap-2 rounded-sm px-2.5 py-1.5 text-left text-xs hover:bg-muted"
                  role="menuitem"
                >
                  <UserIcon className="h-3.5 w-3.5" /> {t('nav.profile')}
                </button>
                <button
                  onClick={async () => {
                    setMenuOpen(false);
                    await logout();
                    router.push('/login');
                  }}
                  className="flex w-full items-center gap-2 rounded-sm px-2.5 py-1.5 text-left text-xs text-seu-red hover:bg-seu-red/10"
                  role="menuitem"
                >
                  <LogOut className="h-3.5 w-3.5" /> {t('auth.logout')}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
