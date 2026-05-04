'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';

/**
 * Scoreboard-style counter — each digit flips when it changes.
 *
 * Used by Doctor Active Session and Live Attendance to convey realtime updates
 * with a tactile feel. We split `value` into individual digit characters and
 * animate only the ones that change between renders.
 */
export function FlipCounter({
  value,
  className,
  digitClassName,
  pad = 0,
}: {
  value: number;
  className?: string;
  digitClassName?: string;
  /** Minimum number of digits (zero-padded on the left). */
  pad?: number;
}) {
  const safe = Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
  const str = String(safe).padStart(pad, '0');
  return (
    <span className={cn('inline-flex items-baseline gap-px tabular-nums', className)} aria-label={String(safe)}>
      {Array.from(str).map((d, i) => (
        <span
          key={`pos-${i}`}
          className={cn(
            'relative inline-block min-w-[0.6em] text-center overflow-hidden',
            digitClassName,
          )}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={`${i}-${d}`}
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '-100%', opacity: 0 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="inline-block"
            >
              {d}
            </motion.span>
          </AnimatePresence>
        </span>
      ))}
    </span>
  );
}
