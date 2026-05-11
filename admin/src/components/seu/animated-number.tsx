"use client";

import { useEffect, useState } from "react";
import { animate, useMotionValue, useTransform, motion } from "framer-motion";

/**
 * Counts up from 0 → `value` over `duration`. Used by KPICard.
 */
export function AnimatedNumber({
  value,
  duration = 1.2,
  className,
  format = (n: number) => Math.round(n).toLocaleString("en-US"),
}: {
  value: number | undefined | null;
  duration?: number;
  className?: string;
  format?: (n: number) => string;
}) {
  const safe = typeof value === "number" && Number.isFinite(value) ? value : 0;
  const mv = useMotionValue(0);
  const display = useTransform(mv, (latest) => format(latest));
  const [_, force] = useState(0);

  useEffect(() => {
    const controls = animate(mv, safe, { duration, ease: "easeOut" });
    return () => controls.stop();
  }, [safe, duration, mv]);

  // We re-render via display motion-value so React paints the formatted string.
  useEffect(() => {
    return display.on("change", () => force((n) => (n + 1) % 1024));
  }, [display]);

  return (
    <motion.span className={className} aria-label={String(safe)}>
      {display.get()}
    </motion.span>
  );
}
