'use client';

import { motion } from 'framer-motion';

/**
 * Wraps each page with the standard fade-up enter animation.
 * Round 2: faster (220ms) and smaller travel (12px → 0).
 */
export function PageEnter({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * Page header — Round 2 (Linear-style).
 *
 * - Single dense row with title + actions inline
 * - Title 18px (was 30px), description 12px secondary
 * - Bottom hairline divider that matches the toolbar pattern
 */
export function PageHeader({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const right = actions ?? children;
  return (
    <div className="mb-4 flex flex-col items-start justify-between gap-2 border-b border-border pb-3 sm:flex-row sm:items-center">
      <div>
        <h1 className="text-[18px] font-semibold leading-tight tracking-tight text-foreground">{title}</h1>
        {description && (
          <p className="mt-0.5 text-[12px] text-muted-foreground">{description}</p>
        )}
      </div>
      {right && <div className="flex flex-wrap items-center gap-1.5">{right}</div>}
    </div>
  );
}
