'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, X } from 'lucide-react';
import { api, unwrapPaginated } from '@/lib/api';
import {
  Button, Card, CardContent, CardDescription, CardHeader, CardTitle,
  FilterChip, Input, Label, Td, Textarea, Th, Toolbar, Tr,
} from '@/components/ui';
import { PageHeader, StatusBadge, TableSkeleton, useToast } from '@/components/seu';

type AtRiskRecord = {
  id: string;
  studentId: string;
  subjectId: string;
  warningLevel: 'warning_1' | 'warning_2' | 'deprivation';
  absenceCount: number;
  triggeredAt: string;
  isResolved: boolean;
  student?: { user: { name: string } };
  subject?: { name: string; code: string };
};

const FILTERS: { key: 'all' | 'warning_1' | 'warning_2' | 'deprivation'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'warning_1', label: 'Warning 1' },
  { key: 'warning_2', label: 'Warning 2' },
  { key: 'deprivation', label: 'Deprivation' },
];

/**
 * Inline sparkline rendering the last 8 weeks of absence trend.
 * Pure SVG, no extra deps.
 */
function Sparkline({ values }: { values: number[] }) {
  if (values.length === 0) return null;
  const w = 64;
  const h = 20;
  const max = Math.max(1, ...values);
  const step = w / Math.max(1, values.length - 1);
  const d = values
    .map((v, i) => `${i === 0 ? 'M' : 'L'} ${(i * step).toFixed(2)} ${(h - (v / max) * h).toFixed(2)}`)
    .join(' ');
  return (
    <svg width={w} height={h} aria-hidden className="overflow-visible">
      <path d={d} stroke="#B1222A" strokeWidth={1.5} fill="none" />
      {values.map((v, i) => (
        <circle key={i} cx={i * step} cy={h - (v / max) * h} r={1.5} fill="#B1222A" />
      ))}
    </svg>
  );
}

export default function AtRiskPage() {
  const { push } = useToast();
  const [filter, setFilter] = useState<typeof FILTERS[number]['key']>('all');
  const [target, setTarget] = useState<AtRiskRecord | null>(null);

  const q = useQuery({
    queryKey: ['at-risk'],
    queryFn: () => unwrapPaginated<AtRiskRecord>(api.get('/at-risk', { params: { page: 1, pageSize: 100 } })),
  });

  const rows = useMemo(() => {
    const items = q.data?.items ?? [];
    if (filter === 'all') return items;
    return items.filter((r) => r.warningLevel === filter);
  }, [q.data, filter]);

  return (
    <>
      <PageHeader
        title="At-Risk Students"
        description="Students approaching or exceeding absence thresholds."
      />

      {/* Toolbar — filter chips inline; counts taken from the unfiltered set. */}
      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-card">
        <Toolbar>
          {FILTERS.map((f) => (
            <FilterChip
              key={f.key}
              active={filter === f.key}
              onClick={() => setFilter(f.key)}
              count={
                f.key === 'all'
                  ? q.data?.items.length
                  : q.data?.items.filter((r) => r.warningLevel === f.key).length
              }
            >
              {f.label}
            </FilterChip>
          ))}
          <span className="ml-auto text-[11px] tabnum text-muted-foreground">
            {rows.length.toLocaleString()} matching
          </span>
        </Toolbar>

        {q.isLoading ? (
          <TableSkeleton rows={6} cols={7} />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr>
                <Th>Student</Th>
                <Th>Subject</Th>
                <Th>Level</Th>
                <Th className="text-right">Absences</Th>
                <Th>Trend</Th>
                <Th>Triggered</Th>
                <Th className="w-px" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
              // Synthesize a stable trend from the row id; replace with real
              // weekly absence series when /at-risk/:id/trend is implemented.
              let h = 0;
              for (let n = 0; n < r.id.length; n++) h = (h * 31 + r.id.charCodeAt(n)) >>> 0;
              const trend = Array.from({ length: 8 }, (_, k) => ((h >> k) & 7) + 1);

              return (
                <Tr key={r.id} index={i}>
                  <Td className="font-medium text-foreground">
                    {r.student?.user.name ?? r.studentId}
                  </Td>
                  <Td className="text-[12.5px] text-muted-foreground">
                    {r.subject ? `${r.subject.code} — ${r.subject.name}` : r.subjectId}
                  </Td>
                  <Td>
                    <StatusBadge tone={r.warningLevel} />
                  </Td>
                  <Td className="tabnum text-right text-[12.5px]">{r.absenceCount}</Td>
                  <Td><Sparkline values={trend} /></Td>
                  <Td className="text-[12.5px] text-muted-foreground tabnum">
                    {new Date(r.triggeredAt).toLocaleDateString()}
                  </Td>
                  <Td className="text-right">
                    <Button size="xs" variant="outline" onClick={() => setTarget(r)}>
                      <Send className="h-3 w-3" /> Alert
                    </Button>
                  </Td>
                </Tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <Td className="text-center text-muted-foreground">No at-risk students.</Td>
                <Td /><Td /><Td /><Td /><Td /><Td />
              </tr>
            )}
            </tbody>
          </table>
        )}
      </div>

      {/* Slide-out alert composer */}
      <AnimatePresence>
        {target && <AlertComposer record={target} onClose={() => setTarget(null)} onSent={() => {
          push({ tone: 'success', title: 'Alert sent' });
          setTarget(null);
        }} />}
      </AnimatePresence>
    </>
  );
}

function AlertComposer({
  record,
  onClose,
  onSent,
}: {
  record: AtRiskRecord;
  onClose: () => void;
  onSent: () => void;
}) {
  const { push } = useToast();
  const [title, setTitle] = useState(`Attendance warning — ${record.subject?.name ?? 'subject'}`);
  const [body, setBody] = useState(
    `Hi ${record.student?.user.name ?? 'student'},\n\nYou currently have ${record.absenceCount} absences in ${record.subject?.name ?? 'this subject'}.`,
  );
  const [busy, setBusy] = useState(false);

  async function send() {
    setBusy(true);
    try {
      await api.post('/notifications', {
        title,
        body,
        targetType: 'user',
        targetId: record.studentId,
      });
      onSent();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Send failed';
      push({ tone: 'error', title: 'Send failed', description: msg });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-40 bg-seu-navy/30 backdrop-blur-sm"
      />
      <motion.aside
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-card shadow-modal"
        role="dialog"
        aria-label="Send alert"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h2 className="text-[15px] font-semibold">Send alert</h2>
            <p className="text-[11px] text-muted-foreground">
              To: {record.student?.user.name ?? record.studentId}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          <div className="space-y-1.5">
            <Label htmlFor="alert-title">Title</Label>
            <Input id="alert-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="alert-body">Body</Label>
            <Textarea
              id="alert-body"
              rows={6}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>
          <Card className="border-seu-gold/40 bg-seu-gold/10">
            <CardHeader className="pb-1.5">
              <CardTitle className="text-[12.5px]">Preview</CardTitle>
              <CardDescription className="text-[11px]">How the student will see it</CardDescription>
            </CardHeader>
            <CardContent className="text-[12.5px]">
              <div className="font-medium">{title || '(no title)'}</div>
              <div className="mt-1 whitespace-pre-line text-muted-foreground">{body || '(no body)'}</div>
            </CardContent>
          </Card>
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
          <Button variant="outline" size="sm" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button size="sm" onClick={send} disabled={busy || !title.trim() || !body.trim()}>
            <Send className="h-3.5 w-3.5" /> {busy ? 'Sending…' : 'Send'}
          </Button>
        </div>
      </motion.aside>
    </>
  );
}
