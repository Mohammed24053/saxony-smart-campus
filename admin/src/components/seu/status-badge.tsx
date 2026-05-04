'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { CheckCircle2, Clock, XCircle, AlertTriangle, Ban, Info } from 'lucide-react';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors',
  {
    variants: {
      tone: {
        present: 'bg-status-success/12 text-status-success ring-1 ring-status-success/20',
        late: 'bg-seu-gold/20 text-[#7a5d10] ring-1 ring-seu-gold/40',
        absent: 'bg-seu-red/10 text-seu-red ring-1 ring-seu-red/30',
        warning_1: 'bg-seu-gold/20 text-[#7a5d10] ring-1 ring-seu-gold/40',
        warning_2: 'bg-orange-500/15 text-orange-700 ring-1 ring-orange-500/30',
        deprivation: 'bg-seu-red/12 text-seu-red ring-1 ring-seu-red/40',
        info: 'bg-status-info/10 text-status-info ring-1 ring-status-info/20',
        neutral: 'bg-muted text-muted-foreground ring-1 ring-border',
      },
    },
    defaultVariants: { tone: 'neutral' },
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

const LABELS: Record<string, string> = {
  present: 'Present',
  late: 'Late',
  absent: 'Absent',
  warning_1: 'Warning 1',
  warning_2: 'Warning 2',
  deprivation: 'Deprivation',
  info: 'Info',
};

export interface StatusBadgeProps extends VariantProps<typeof badgeVariants> {
  className?: string;
  /** Override label; defaults to a localized string for the tone. */
  children?: React.ReactNode;
  /** Hide the leading icon (icon-only contexts already have one elsewhere). */
  noIcon?: boolean;
}

export function StatusBadge({ tone, className, children, noIcon }: StatusBadgeProps) {
  const Icon = ICONS[tone ?? 'neutral'] ?? Info;
  const label = children ?? LABELS[tone ?? 'neutral'] ?? '—';
  return (
    <span className={cn(badgeVariants({ tone }), className)}>
      {!noIcon && <Icon className="h-3.5 w-3.5" />}
      {label}
    </span>
  );
}
