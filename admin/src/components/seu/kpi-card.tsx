"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatedNumber } from "./animated-number";

/**
 * KPI card — Round 2 (Linear-style dense).
 *
 * Layout: tight vertical stack
 *   1. ICON (12×12 muted) + LABEL (uppercase tracking-wide 10px)
 *   2. VALUE (28px tabular-nums) + optional inline trend chip
 *   3. Optional sub-label (e.g. "out of 245")
 *
 * Compared to v1: removed the gold top-stripe (too marketing), removed the
 * card padding from p-5→p-3, dropped to a hairline border, and put the trend
 * chip inline next to the value rather than below.
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
  /** Show a red ALERT badge in the corner when value > 0. */
  danger?: boolean;
  /** Optional hint shown under the value (e.g., "of 245"). */
  hint?: string;
  /** Optional sparkline points for an at-a-glance trend (dashboard only). */
  spark?: number[];
  className?: string;
}

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
};

export function KPICard({
  label,
  value,
  format,
  trend,
  icon: Icon,
  live,
  danger,
  hint,
  spark,
  className,
}: KPICardProps) {
  return (
    <motion.div
      variants={itemVariants}
      whileHover={{ y: -1 }}
      transition={{ duration: 0.18 }}
      className={cn(
        "relative overflow-hidden rounded-lg border border-border bg-card p-3.5 shadow-card",
        "hover:shadow-card-lift hover:border-seu-navy/15",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[11.5px] font-medium uppercase tracking-wider text-muted-foreground">
          {Icon && <Icon className="h-3 w-3 text-muted-foreground" />}
          <span className="truncate">{label}</span>
        </div>
        {live && (
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-live-dot rounded-full bg-status-success/60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-status-success" />
          </span>
        )}
        {danger && typeof value === "number" && value > 0 && (
          <span className="rounded bg-seu-red/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-seu-red ring-1 ring-seu-red/20">
            ALERT
          </span>
        )}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-[28px] font-semibold leading-none tabnum text-foreground">
          {value === undefined || value === null ? (
            <span className="inline-block h-7 w-14 rounded skeleton" />
          ) : (
            <AnimatedNumber value={value} format={format} />
          )}
        </span>
        {typeof trend === "number" && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-[12px] font-medium tabnum",
              trend > 0 && "text-status-success",
              trend < 0 && "text-seu-red",
              trend === 0 && "text-muted-foreground",
            )}
          >
            {trend > 0 ? (
              <ArrowUpRight className="h-3 w-3" />
            ) : trend < 0 ? (
              <ArrowDownRight className="h-3 w-3" />
            ) : (
              <Minus className="h-3 w-3" />
            )}
            {Math.abs(trend).toFixed(1)}%
          </span>
        )}
      </div>
      {(hint || spark) && (
        <div className="mt-1.5 flex items-center justify-between gap-2 text-[12px] text-muted-foreground">
          {hint && <span className="truncate">{hint}</span>}
          {spark && spark.length > 1 && <Sparkline points={spark} />}
        </div>
      )}
    </motion.div>
  );
}

/** Tiny inline SVG sparkline. Width 60×16, normalizes to data range. */
function Sparkline({ points }: { points: number[] }) {
  const w = 60;
  const h = 16;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const step = w / (points.length - 1);
  const path = points
    .map((p, i) => {
      const x = i * step;
      const y = h - ((p - min) / range) * h;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0">
      <motion.path
        d={path}
        stroke="hsl(var(--primary))"
        strokeWidth="1.25"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      />
    </svg>
  );
}

/** Container that staggers KPICard children (50ms delay each). */
export function KPIRow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.05 } } }}
      className={cn(
        "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4",
        className,
      )}
    >
      {children}
    </motion.div>
  );
}
