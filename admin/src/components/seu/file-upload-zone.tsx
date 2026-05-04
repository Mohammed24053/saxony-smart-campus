'use client';

import { useCallback, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileSpreadsheet, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui';

export interface FileUploadZoneProps {
  /** Accept attribute (e.g. ".xlsx,.xls"). */
  accept?: string;
  onUpload: (file: File) => Promise<{ progress?: never } | void>;
  /** Optional progress callback (0–100) emitted by axios `onUploadProgress`. */
  progress?: number;
  /** Optional small subline (e.g. "Excel files up to 5MB"). */
  hint?: string;
  busy?: boolean;
  className?: string;
}

export function FileUploadZone({
  accept = '.xlsx,.xls',
  onUpload,
  progress,
  hint,
  busy,
  className,
}: FileUploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [hover, setHover] = useState(false);
  const [picked, setPicked] = useState<File | null>(null);

  const handle = useCallback(
    async (file: File) => {
      setPicked(file);
      try {
        await onUpload(file);
      } finally {
        if (inputRef.current) inputRef.current.value = '';
      }
    },
    [onUpload],
  );

  return (
    <motion.div
      initial={false}
      animate={hover ? { scale: 1.01, borderColor: '#B1222A' } : { scale: 1, borderColor: 'rgba(49,49,59,0.12)' }}
      onDragOver={(e) => {
        e.preventDefault();
        setHover(true);
      }}
      onDragLeave={() => setHover(false)}
      onDrop={(e) => {
        e.preventDefault();
        setHover(false);
        const f = e.dataTransfer.files?.[0];
        if (f) handle(f);
      }}
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed bg-card p-8 text-center transition-colors',
        hover && 'bg-seu-cream',
        className,
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-seu-red/10 text-seu-red">
        <Upload className="h-6 w-6" />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">
          Drop your file here, or{' '}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="text-seu-red underline-offset-4 hover:underline"
          >
            browse
          </button>
        </p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handle(f);
        }}
      />

      <AnimatePresence>
        {picked && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-2 flex w-full items-center gap-3 rounded-md border border-border bg-muted/40 p-3 text-left"
          >
            <FileSpreadsheet className="h-5 w-5 text-status-success" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{picked.name}</div>
              <div className="text-xs text-muted-foreground">{(picked.size / 1024).toFixed(1)} KB</div>
              {typeof progress === 'number' && (
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-seu-red/15">
                  <motion.div
                    className="h-full bg-seu-red"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              )}
            </div>
            {!busy && (
              <Button variant="ghost" size="icon" type="button" onClick={() => setPicked(null)} aria-label="Clear">
                <X className="h-4 w-4" />
              </Button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
