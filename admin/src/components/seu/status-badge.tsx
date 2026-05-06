"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  Ban,
  Info,
} from "lucide-react";
import { useT } from "@/i18n/i18n";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors",
  {
    variants: {
      tone: {
        present:
          "bg-status-success/12 text-status-success ring-1 ring-status-success/20",
        late: "bg-seu-gold/20 text-[#7a5d10] ring-1 ring-seu-gold/40",
        absent: "bg-seu-red/10 text-seu-red ring-1 ring-seu-red/30",
        warning_1: "bg-seu-gold/20 text-[#7a5d10] ring-1 ring-seu-gold/40",
        warning_2: "bg-orange-500/15 text-orange-700 ring-1 ring-orange-500/30",
        deprivation: "bg-seu-red/12 text-seu-red ring-1 ring-seu-red/40",
        info: "bg-status-info/10 text-status-info ring-1 ring-status-info/20",
        neutral: "bg-muted text-muted-foreground ring-1 ring-border",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  present: CheckCircle2,
  late: Clock,
  absent: XCircle,
  warning_1: AlertTriangle,
  warning_2: AlertTriangle,
  deprivation: Ban,
  info: Info,
  neutral: Info,
};

const LABEL_KEYS: Record<string, string> = {
  present: "attendance.present",
  late: "attendance.late",
  absent: "attendance.absent",
  warning_1: "atRisk.warning1",
  warning_2: "atRisk.warning2",
  deprivation: "atRisk.deprivation",
  info: "common.status",
};

export interface StatusBadgeProps extends VariantProps<typeof badgeVariants> {
  className?: string;
  /** Override label; defaults to a localized string for the tone. */
  children?: React.ReactNode;
  /** Hide the leading icon (icon-only contexts already have one elsewhere). */
  noIcon?: boolean;
}

export function StatusBadge({
  tone,
  className,
  children,
  noIcon,
}: StatusBadgeProps) {
  const { t } = useT();
  const Icon = ICONS[tone ?? "neutral"] ?? Info;
  const key = LABEL_KEYS[tone ?? "neutral"];
  const label = children ?? (key ? t(key) : "—");
  return (
    <span className={cn(badgeVariants({ tone }), className)}>
      {!noIcon && <Icon className="h-3 w-3" />}
      {label}
    </span>
  );
}
