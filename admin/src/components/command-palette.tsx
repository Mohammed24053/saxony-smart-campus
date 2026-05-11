"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  BookOpen,
  Building2,
  CalendarRange,
  ClipboardCheck,
  GraduationCap,
  History,
  KeyRound,
  Layers,
  LayoutDashboard,
  Search,
  Settings,
  Shield,
  Users,
  UserSquare,
} from "lucide-react";
import { useT } from "@/i18n/i18n";
import { cn } from "@/lib/utils";

type Cmd = {
  id: string;
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  group: string;
};

/**
 * Cmd+K palette — quick navigation across every admin page.
 * Filters by label / group prefix, keyboard navigation (↑/↓/Enter), Esc to close.
 */
export function CommandPalette() {
  const { t } = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const all: Cmd[] = useMemo(
    () => [
      {
        id: "dash",
        href: "/dashboard",
        label: t("nav.dashboard"),
        icon: LayoutDashboard,
        group: "Pages",
      },
      {
        id: "stu",
        href: "/students",
        label: t("nav.students"),
        icon: Users,
        group: "Pages",
      },
      {
        id: "doc",
        href: "/doctors",
        label: t("nav.doctors"),
        icon: GraduationCap,
        group: "Pages",
      },
      {
        id: "rom",
        href: "/rooms",
        label: t("nav.rooms"),
        icon: Building2,
        group: "Pages",
      },
      {
        id: "sub",
        href: "/subjects",
        label: t("nav.subjects"),
        icon: BookOpen,
        group: "Pages",
      },
      {
        id: "sec",
        href: "/sections",
        label: t("nav.sections"),
        icon: Layers,
        group: "Pages",
      },
      {
        id: "sch",
        href: "/schedule",
        label: t("nav.schedule"),
        icon: CalendarRange,
        group: "Pages",
      },
      {
        id: "att",
        href: "/attendance",
        label: t("nav.attendance"),
        icon: ClipboardCheck,
        group: "Pages",
      },
      {
        id: "risk",
        href: "/at-risk",
        label: t("nav.atRisk"),
        icon: AlertTriangle,
        group: "Pages",
      },
      {
        id: "not",
        href: "/notifications",
        label: t("nav.notifications"),
        icon: Bell,
        group: "Pages",
      },
      {
        id: "noth",
        href: "/notifications-history",
        label: `${t("nav.notifications")} — ${t("notifications.history")}`,
        icon: History,
        group: "Pages",
      },
      {
        id: "ana",
        href: "/analytics",
        label: t("nav.analytics"),
        icon: BarChart3,
        group: "Pages",
      },
      {
        id: "usr",
        href: "/users",
        label: t("nav.users"),
        icon: Users,
        group: "Admin",
      },
      {
        id: "aud",
        href: "/audit-log",
        label: t("nav.auditLog"),
        icon: Shield,
        group: "Admin",
      },
      {
        id: "set",
        href: "/settings",
        label: t("nav.settings"),
        icon: Settings,
        group: "Admin",
      },
      {
        id: "pro",
        href: "/profile",
        label: t("nav.profile"),
        icon: UserSquare,
        group: "Account",
      },
      {
        id: "fpw",
        href: "/forgot-password",
        label: t("auth.forgotPassword"),
        icon: KeyRound,
        group: "Account",
      },
    ],
    [t],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (c) =>
        c.label.toLowerCase().includes(q) || c.group.toLowerCase().includes(q),
    );
  }, [all, query]);

  // Cmd/Ctrl + K toggles open
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (active >= filtered.length) setActive(0);
  }, [filtered, active]);

  function go(c: Cmd) {
    setOpen(false);
    router.push(c.href);
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
        <Dialog.Content
          className="fixed left-1/2 top-[20vh] z-50 w-full max-w-lg -translate-x-1/2 overflow-hidden rounded-lg border border-border bg-card shadow-modal data-[state=open]:animate-scale-in"
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, filtered.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              const c = filtered[active];
              if (c) go(c);
            }
          }}
        >
          <Dialog.Title className="sr-only">Command palette</Dialog.Title>
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("common.search")}
              className="h-7 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              autoFocus
            />
            <kbd className="hidden rounded border border-border bg-muted px-1 py-px font-mono text-[11px] text-muted-foreground sm:inline-block">
              Esc
            </kbd>
          </div>
          <ul className="max-h-80 overflow-y-auto p-1.5">
            {filtered.length === 0 ? (
              <li className="px-3 py-4 text-center text-xs text-muted-foreground">
                {t("common.noResults")}
              </li>
            ) : (
              filtered.map((c, i) => (
                <li key={c.id}>
                  <button
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(c)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-sm",
                      i === active
                        ? "bg-seu-red/10 text-seu-red"
                        : "hover:bg-muted",
                    )}
                  >
                    <c.icon className="h-3.5 w-3.5" />
                    <span className="flex-1 truncate">{c.label}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {c.group}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
