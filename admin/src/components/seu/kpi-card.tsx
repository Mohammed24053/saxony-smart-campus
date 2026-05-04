'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AnimatedNumber } from './animated-number';

/**
 * KPI card with animated count-up, optional trend, optional live-dot,
 * and optional gold top accent (per design spec).
 *
 * The wrapping <motion.div> participates in a parent <motion.div variants>
 * stagger so the four KPIs fade-up in sequence when the dashboard mounts.
 */
export interface KPICardProps {
  label: string;
  value: number | undefined | null;
  /** Pre-formatter; defaults to integer with thousands separator. */
  format?: (n: number) => string;
  /** Optional trend percentage (positive = up arrow). */
  trend?: number;
  /** Optional Lucide icon. */
  icon?: React.ComponentType<{ className?: string }>;
  /** Pulse a green dot in the corner (used for "Active lectures"). */
  live?: boolean;
  /** Show a red badge in the corner (used when value > 0 and intent is "danger"). */
  danger?: boolean;
  className?: string;
}

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};

export function KPICard({
  label,
  value,
  format,
  trend,
  icon: Icon,
  live,
  danger,
  className,
}: KPICardProps) {
  return (
    <motion.div
      variants={itemVariants}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'relative overflow-hidden rounded-lg border border-border bg-card p-5 shadow-card',
        'before:absolute before:left-0 before:right-0 before:top-0 before:h-1 before:bg-seu-gold',
        className,
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {Icon && <Icon className="h-4 w-4 text-seu-navy/70" />}
          <span>{label}</span>
        </div>
        {live && (
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-live-dot rounded-full bg-status-success/60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-status-success" />
          </span>
        )}
        {danger && typeof value === 'number' && value > 0 && (
          <span className="rounded-full bg-seu-red px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
            ALERT
          </span>
        )}
      </div>
      <div className="mt-3 text-3xl font-semibold tabular-nums text-foreground">
        {value === undefined || value === null ? (
          <span className="inline-block h-9 w-16 rounded skeleton" />
        ) : (
          <AnimatedNumber value={value} format={format} />
        )}
      </div>
      {typeof trend === 'number' && (
        <div
          className={cn(
            'mt-2 inline-flex items-center gap-1 text-xs font-medium',
            trend > 0 && 'text-status-success',
            trend < 0 && 'text-seu-red',
            trend === 0 && 'text-muted-foreground',
          )}
        >
          {trend > 0 ? <ArrowUpRight className="h-3 w-3" /> : trend < 0 ? <ArrowDownRight className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
          {Math.abs(trend).toFixed(1)}% vs last week
        </div>
      )}
    </motion.div>
  );
}

/** Container that staggers KPICard children (50ms delay each). */
export function KPIRow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.05 } } }}
      className={cn('grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4', className)}
    >
      {children}
    </motion.div>
  );
}
