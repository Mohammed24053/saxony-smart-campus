"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastTone = "success" | "info" | "warning" | "error";
interface ToastItem {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string;
  ttl: number;
}

interface ToastCtx {
  push: (t: Omit<ToastItem, "id" | "ttl"> & { ttl?: number }) => void;
}

const Ctx = createContext<ToastCtx | null>(null);

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast() must be used inside <ToastProvider>");
  return ctx;
}

const ICONS = {
  success: CheckCircle2,
  info: Info,
  warning: AlertTriangle,
  error: XCircle,
};

const TONE_STYLES: Record<ToastTone, string> = {
  success: "border-l-status-success bg-card",
  info: "border-l-status-info bg-card",
  warning: "border-l-seu-gold bg-card",
  error: "border-l-seu-red bg-card",
};

const TONE_ICON_BG: Record<ToastTone, string> = {
  success: "bg-status-success/12 text-status-success",
  info: "bg-status-info/12 text-status-info",
  warning: "bg-seu-gold/20 text-[#7a5d10]",
  error: "bg-seu-red/12 text-seu-red",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const push: ToastCtx["push"] = useCallback((t) => {
    const id = Date.now() + Math.random();
    const ttl = t.ttl ?? 4000;
    setToasts((prev) => [...prev, { ...t, id, ttl }]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), ttl);
  }, []);

  return (
    <Ctx.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-full max-w-sm flex-col gap-2">
        <AnimatePresence>
          {toasts.map((t) => {
            const Icon = ICONS[t.tone];
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, x: 40, scale: 0.96 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 40, scale: 0.96 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className={cn(
                  "pointer-events-auto relative overflow-hidden rounded-lg border-l-4 border border-border shadow-card",
                  TONE_STYLES[t.tone],
                )}
              >
                <div className="flex gap-3 p-4">
                  <div
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                      TONE_ICON_BG[t.tone],
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-foreground">
                      {t.title}
                    </div>
                    {t.description && (
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {t.description}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() =>
                      setToasts((prev) => prev.filter((x) => x.id !== t.id))
                    }
                    className="text-muted-foreground hover:text-foreground"
                    aria-label="Dismiss"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div
                  className="absolute bottom-0 left-0 h-0.5 bg-current opacity-30 animate-drain"
                  style={{ animationDuration: `${t.ttl}ms` }}
                />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}
