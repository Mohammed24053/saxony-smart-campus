'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/*  Round 2 — Data-Dense primitives (Linear-style).                   */
/*  All sizes are tightened by ~4-8px, radii sharpened to 8/12.       */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Button — SEU-themed with size + variant + press micro-interaction */
/* ------------------------------------------------------------------ */

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-all duration-200 ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ' +
    'disabled:pointer-events-none disabled:opacity-50 select-none whitespace-nowrap',
  {
    variants: {
      variant: {
        // Primary CTA — SEU red, lifts on hover, brand-colored shadow.
        default:
          'bg-seu-red text-white shadow-sm hover:bg-seu-red-hover hover:-translate-y-0.5 hover:shadow-btn-hover active:translate-y-0',
        // Secondary — gold accent.
        accent:
          'bg-seu-gold text-seu-navy shadow-sm hover:bg-seu-gold-hover hover:-translate-y-0.5 active:translate-y-0',
        outline:
          'border border-border bg-card text-foreground hover:bg-muted hover:border-seu-navy/30',
        // Same as `default` but semantic (danger).
        destructive:
          'bg-seu-red text-white shadow-sm hover:bg-seu-red-hover hover:-translate-y-0.5 hover:shadow-btn-hover',
        ghost: 'text-foreground hover:bg-muted',
        link: 'text-seu-red underline-offset-4 hover:underline',
      },
      size: {
        // Linear-style: 28 / 32 / 36 / 40 (icon).
        xs: 'h-7 px-2.5 text-xs',
        sm: 'h-8 px-3 text-xs',
        default: 'h-9 px-3.5 text-sm',
        lg: 'h-10 px-5 text-sm',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export type ButtonProps = HTMLMotionProps<'button'> & VariantProps<typeof buttonVariants>;

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <motion.button
      ref={ref}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.1 }}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  ),
);
Button.displayName = 'Button';

/* ------------------------------------------------------------------ */
/*  Input + Textarea + Label                                          */
/* ------------------------------------------------------------------ */

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'flex h-9 w-full rounded-md border border-border bg-card px-3 py-1.5 text-sm transition-colors',
        'placeholder:text-muted-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-seu-red',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'flex min-h-[72px] w-full rounded-md border border-border bg-card px-3 py-2 text-sm transition-colors',
        'placeholder:text-muted-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-seu-red',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';

export const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn('text-xs font-medium leading-none text-muted-foreground uppercase tracking-wide', className)}
      {...props}
    />
  ),
);
Label.displayName = 'Label';

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        'flex h-9 w-full rounded-md border border-border bg-card px-2.5 py-1.5 text-sm transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-seu-red',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  ),
);
Select.displayName = 'Select';

/* ------------------------------------------------------------------ */
/*  Card — 12px radius, hairline border, quiet shadow                 */
/* ------------------------------------------------------------------ */

export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-lg border border-border bg-card text-card-foreground shadow-card',
        'transition-shadow',
        className,
      )}
      {...props}
    />
  ),
);
Card.displayName = 'Card';

export const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'flex flex-col space-y-0.5 px-4 py-3 border-b border-border/60',
        className,
      )}
      {...props}
    />
  ),
);
CardHeader.displayName = 'CardHeader';

export const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn('text-sm font-semibold leading-tight tracking-tight', className)} {...props} />
  ),
);
CardTitle.displayName = 'CardTitle';

export const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn('text-xs text-muted-foreground', className)} {...props} />
  ),
);
CardDescription.displayName = 'CardDescription';

export const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('px-4 py-3', className)} {...props} />
  ),
);
CardContent.displayName = 'CardContent';

/* ------------------------------------------------------------------ */
/*  Table primitives — dense (36px row, 32px head, sticky head)       */
/* ------------------------------------------------------------------ */

export function Table({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('w-full overflow-auto rounded-lg border border-border bg-card shadow-card', className)}>
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}

export const Th = ({ children, className }: { children?: React.ReactNode; className?: string }) => (
  <th
    className={cn(
      'sticky top-0 z-10 h-th px-3 text-left font-medium text-[11px] uppercase tracking-wider text-muted-foreground bg-muted/85 backdrop-blur',
      'border-b border-border',
      className,
    )}
  >
    {children}
  </th>
);

export const Td = ({ children, className }: { children?: React.ReactNode; className?: string }) => (
  <td
    className={cn(
      'border-t border-border/60 px-3 align-middle text-[13px]',
      className,
    )}
    style={{ height: 'var(--density-row)' }}
  >
    {children}
  </td>
);

/**
 * Animated table row — staggers its entrance (20ms per row) and lifts on hover.
 *
 *  ⚠ Intentionally typed loose because Framer Motion's polymorphic types fight
 *  the (legitimately required) `colSpan` etc. props on `<tr>`.
 */
export function Tr({
  children,
  index = 0,
  className,
  ...rest
}: React.HTMLAttributes<HTMLTableRowElement> & { index?: number }) {
  return (
    <motion.tr
      initial={{ opacity: 0, y: 3 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, delay: Math.min(index, 25) * 0.018, ease: 'easeOut' }}
      className={cn('group transition-colors hover:bg-muted/40', className)}
      {...(rest as HTMLMotionProps<'tr'>)}
    >
      {children}
    </motion.tr>
  );
}

/* ------------------------------------------------------------------ */
/*  Density-aware utility primitives                                  */
/* ------------------------------------------------------------------ */

/** Filter chip — used in toolbars (At-Risk severity filter, Schedule filters, etc.). */
export function FilterChip({
  active,
  onClick,
  children,
  count,
}: {
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors',
        active
          ? 'border-seu-red bg-seu-red/10 text-seu-red'
          : 'border-border bg-card text-muted-foreground hover:border-seu-navy/30 hover:text-foreground',
      )}
    >
      {children}
      {typeof count === 'number' && (
        <span
          className={cn(
            'tabnum rounded-full px-1.5 py-px text-[10px]',
            active ? 'bg-seu-red text-white' : 'bg-muted text-muted-foreground',
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

/** Toolbar — sits above tables (search + filter chips + actions). */
export function Toolbar({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2 border-b border-border bg-card px-3 py-2',
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Vertical separator between toolbar groups. */
export function ToolbarSep() {
  return <span className="mx-1 h-4 w-px bg-border" aria-hidden />;
}

/** Section divider used inside cards (between header and chart). */
export function CardDivider() {
  return <div className="h-px w-full bg-border/60" aria-hidden />;
}
