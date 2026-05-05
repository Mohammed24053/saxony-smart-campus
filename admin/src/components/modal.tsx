'use client';

import * as React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const sizeMap = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' };

/**
 * SEU dialog with brand-styled chrome. Built on Radix Dialog so focus trapping,
 * escape-to-close, and aria roles are handled. Spring scale-in animation on open.
 */
export function Modal({ open, onOpenChange, title, description, children, footer, size = 'md' }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-fade-up" />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 w-full -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-card p-5 shadow-modal',
            'data-[state=open]:animate-scale-in',
            sizeMap[size],
          )}
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="text-base font-semibold text-foreground">{title}</Dialog.Title>
              {description && (
                <Dialog.Description className="mt-1 text-xs text-muted-foreground">{description}</Dialog.Description>
              )}
            </div>
            <Dialog.Close
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>
          <div className="space-y-3">{children}</div>
          {footer && <div className="mt-5 flex items-center justify-end gap-2">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Confirm modal (yes/no) — reusable for delete, log-out-all, etc. */
export function ConfirmModal({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
}) {
  const [busy, setBusy] = React.useState(false);
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <button
            className="h-8 rounded-md border border-border bg-card px-3 text-xs hover:bg-muted"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            {cancelLabel}
          </button>
          <button
            className={cn(
              'h-8 rounded-md px-3 text-xs font-medium text-white',
              destructive ? 'bg-seu-red hover:bg-seu-red-hover' : 'bg-seu-navy hover:bg-seu-navy/90',
              busy && 'opacity-50',
            )}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
                onOpenChange(false);
              } finally {
                setBusy(false);
              }
            }}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <span className="sr-only">{title}</span>
    </Modal>
  );
}
