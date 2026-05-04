'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'framer-motion';
import { Download, Search, Upload, X } from 'lucide-react';
import { api, unwrapPaginated } from '@/lib/api';
import { Button, Card, Input, Table, Td, Th, Tr } from '@/components/ui';
import { FileUploadZone, PageHeader, TableSkeleton, useToast } from '@/components/seu';

type Student = {
  id: string;
  studentId: string;
  name: string;
  email?: string;
  faculty?: string;
  year?: number;
  sectionId?: string;
};

/**
 * Renders an avatar using initials of the student name. Background colour
 * cycles deterministically through the brand palette so the same student
 * keeps the same chip across renders.
 */
function Avatar({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? '')
    .join('') || '?';
  const palette = ['#B1222A', '#31313B', '#E4BD4F', '#1976D2', '#2E7D32'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  const bg = palette[hash % palette.length];
  return (
    <span
      className="inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white"
      style={{ backgroundColor: bg }}
      aria-hidden
    >
      {initials}
    </span>
  );
}

export default function StudentsPage() {
  const qc = useQueryClient();
  const { push } = useToast();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [importOpen, setImportOpen] = useState(false);

  const q = useQuery({
    queryKey: ['students', page, search],
    queryFn: () =>
      unwrapPaginated<Student>(api.get('/students', { params: { page, pageSize: 25, search } })),
  });

  const importMu = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      return api.post('/students/import', fd);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['students'] });
      push({ tone: 'success', title: 'Import complete', description: 'Students imported from spreadsheet.' });
      setImportOpen(false);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Import failed';
      push({ tone: 'error', title: 'Import failed', description: msg });
    },
  });

  return (
    <>
      <PageHeader
        title="Students"
        description="Manage enrolled students."
        actions={
          <>
            <Button
              variant="outline"
              onClick={async () => {
                const r = await api.get('/students/import/template', { responseType: 'blob' });
                const url = URL.createObjectURL(new Blob([r.data]));
                const a = document.createElement('a');
                a.href = url;
                a.download = 'students-template.xlsx';
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              <Download className="h-4 w-4" /> Download template
            </Button>
            <Button onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4" /> Import Excel
            </Button>
          </>
        }
      />

      <Card className="mb-4 p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, student ID…"
            className="h-10 pl-9"
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
          />
        </div>
      </Card>

      {q.isLoading ? (
        <TableSkeleton rows={6} cols={5} />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Student</Th>
              <Th>Student ID</Th>
              <Th>Email</Th>
              <Th>Faculty</Th>
              <Th>Year</Th>
            </tr>
          </thead>
          <tbody>
            {q.data?.items.map((s, i) => (
              <Tr key={s.id} index={i}>
                <Td>
                  <div className="flex items-center gap-3">
                    <Avatar name={s.name} />
                    <div className="font-medium text-foreground">{s.name}</div>
                  </div>
                </Td>
                <Td className="font-mono tabular-nums text-xs text-muted-foreground">{s.studentId}</Td>
                <Td>{s.email ?? '—'}</Td>
                <Td>{s.faculty ?? '—'}</Td>
                <Td>{s.year ?? '—'}</Td>
              </Tr>
            ))}
            {q.data && q.data.items.length === 0 && (
              <tr>
                <Td className="text-muted-foreground" >
                  No students yet — import an Excel file to get started.
                </Td>
                <Td /><Td /><Td /><Td />
              </tr>
            )}
          </tbody>
        </Table>
      )}

      {q.data && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-4 flex items-center justify-between text-sm text-muted-foreground"
        >
          <span>{q.data.total} total</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <span className="px-2">
              Page {q.data.page} / {Math.max(q.data.totalPages, 1)}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page * q.data.pageSize >= q.data.total}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </motion.div>
      )}

      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onUpload={(f) => importMu.mutateAsync(f)}
        busy={importMu.isPending}
      />
    </>
  );
}

function ImportModal({
  open,
  onClose,
  onUpload,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  onUpload: (f: File) => Promise<unknown>;
  busy: boolean;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-50 bg-seu-navy/40 backdrop-blur-sm"
              />
            </Dialog.Overlay>
            <Dialog.Content asChild>
              <motion.div
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ type: 'spring', stiffness: 320, damping: 26 }}
                className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-card p-6 shadow-modal"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <Dialog.Title className="text-lg font-semibold">Import students from Excel</Dialog.Title>
                    <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                      Upload an .xlsx file matching the template. Errors will be reported per row.
                    </Dialog.Description>
                  </div>
                  <button onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-foreground">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="mt-4">
                  <FileUploadZone
                    accept=".xlsx,.xls"
                    hint="Excel files up to 5MB. Use the template for the correct columns."
                    onUpload={async (f) => {
                      await onUpload(f);
                    }}
                    busy={busy}
                  />
                </div>
                <div className="mt-4 flex justify-end">
                  <Button variant="outline" onClick={onClose}>Done</Button>
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
