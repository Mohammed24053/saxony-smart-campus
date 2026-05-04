'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, Loader2, Wand2 } from 'lucide-react';
import { api, unwrap } from '@/lib/api';
import { Button, Card, CardContent } from '@/components/ui';
import { ConfirmModal, PageHeader, useToast } from '@/components/seu';
import { cn } from '@/lib/utils';

type Slot = {
  id: string; subjectId: string; sectionId: string; doctorId: string; roomId: string;
  dayOfWeek: number; startTime: string; endTime: string;
  subject?: { name: string }; doctor?: { user?: { name: string } };
  room?: { name: string }; section?: { name: string };
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Six accent colours for slot pills, cycling deterministically by subject. */
const SLOT_COLORS = [
  { bg: 'rgba(177, 34, 42, 0.10)', accent: '#B1222A' },
  { bg: 'rgba(228, 189, 79, 0.18)', accent: '#cda737' },
  { bg: 'rgba(25, 118, 210, 0.10)', accent: '#1976D2' },
  { bg: 'rgba(46, 125, 50, 0.10)', accent: '#2E7D32' },
  { bg: 'rgba(49, 49, 59, 0.06)', accent: '#31313B' },
  { bg: 'rgba(231, 138, 51, 0.12)', accent: '#cd7d2d' },
];
function colorForSubject(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return SLOT_COLORS[h % SLOT_COLORS.length];
}

export default function SchedulePage() {
  const qc = useQueryClient();
  const { push } = useToast();
  const [confirmGenerate, setConfirmGenerate] = useState(false);
  const [confirmPublish, setConfirmPublish] = useState(false);

  const slotsQ = useQuery({
    queryKey: ['schedule'],
    queryFn: () => unwrap<Slot[]>(api.get('/schedule')),
  });
  const conflictsQ = useQuery({
    queryKey: ['schedule', 'conflicts'],
    queryFn: () => unwrap<{ reason: string; subjectId: string }[]>(api.get('/schedule/conflicts')),
  });

  const generateMu = useMutation({
    mutationFn: () => api.post('/schedule/generate'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedule'] });
      push({ tone: 'success', title: 'Schedule generated', description: 'Conflict-free slots written to database.' });
      setConfirmGenerate(false);
    },
    onError: () => push({ tone: 'error', title: 'Generation failed' }),
  });
  const publishMu = useMutation({
    mutationFn: () => api.post('/schedule/publish'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedule'] });
      push({ tone: 'success', title: 'Schedule published', description: 'Visible to students and doctors.' });
      setConfirmPublish(false);
    },
    onError: () => push({ tone: 'error', title: 'Publish failed' }),
  });

  // Build a `Map<day-time, Slot[]>` so the grid can render in O(1).
  const grid = useMemo(() => {
    const cells: Record<string, Slot[]> = {};
    (slotsQ.data ?? []).forEach((s) => {
      const key = `${s.dayOfWeek}-${s.startTime}`;
      cells[key] = [...(cells[key] ?? []), s];
    });
    return cells;
  }, [slotsQ.data]);

  // Subjects involved in any conflict (so their slots get the pulse ring).
  const conflictSubjects = useMemo(
    () => new Set((conflictsQ.data ?? []).map((c) => c.subjectId)),
    [conflictsQ.data],
  );

  const hours = Array.from({ length: 11 }, (_, i) => 8 + i);
  const slotCount = slotsQ.data?.length ?? 0;
  const conflictCount = conflictsQ.data?.length ?? 0;

  return (
    <>
      <PageHeader
        title="Schedule"
        description={`${slotCount} scheduled slot${slotCount === 1 ? '' : 's'}`}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setConfirmGenerate(true)} disabled={generateMu.isPending}>
              {generateMu.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
              Auto-generate
            </Button>
            <Button size="sm" onClick={() => setConfirmPublish(true)} disabled={publishMu.isPending || conflictCount > 0}>
              <CheckCircle2 className="h-3.5 w-3.5" /> Publish
            </Button>
          </>
        }
      />

      {/* Week navigation (week index is currently a noop — backend serves "current" only). */}
      <Card className="mb-3">
        <CardContent className="flex items-center justify-between py-1.5">
          <Button variant="ghost" size="xs">
            <ChevronLeft className="h-3 w-3" /> Previous
          </Button>
          <div className="text-[12.5px] font-medium">Current week</div>
          <Button variant="ghost" size="xs">
            Next <ChevronRight className="h-3 w-3" />
          </Button>
        </CardContent>
      </Card>

      {/* Conflict banner */}
      <AnimatePresence>
        {conflictCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mb-3"
          >
            <Card className="border-seu-red/40 bg-seu-red/5">
              <CardContent className="flex items-start gap-2.5 py-3">
                <AlertCircle className="mt-0.5 h-4 w-4 text-seu-red" />
                <div>
                  <div className="text-[12.5px] font-semibold text-seu-red">{conflictCount} conflicts detected</div>
                  <ul className="mt-1.5 list-disc pl-4 text-[12px] text-seu-red/90">
                    {(conflictsQ.data ?? []).slice(0, 5).map((c, i) => (
                      <li key={i}>{c.reason}</li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Published banner (when no conflicts) */}
      {slotCount > 0 && conflictCount === 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-3">
          <Card className="border-status-success/40 bg-status-success/5">
            <CardContent className="flex items-center gap-2 py-2 text-[12px]">
              <CheckCircle2 className="h-3.5 w-3.5 text-status-success" />
              <span className="font-medium text-status-success">Schedule is conflict-free and ready to publish.</span>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <Card className="overflow-auto p-0">
        <table className="w-full text-[11px]">
          <thead className="sticky top-0 z-10 bg-muted/85 backdrop-blur">
            <tr>
              <th className="sticky left-0 z-20 h-th border-b border-r border-border bg-muted/85 px-2 text-left font-medium uppercase tracking-wider text-[10px] text-muted-foreground">Time</th>
              {DAYS.map((d) => (
                <th key={d} className="h-th border-b border-r border-border px-2 text-left font-medium uppercase tracking-wider text-[10px] text-muted-foreground">
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {hours.map((h) => {
              const t = `${String(h).padStart(2, '0')}:00`;
              return (
                <tr key={h}>
                  <td className="sticky left-0 z-10 border-r border-t border-border bg-muted/30 px-2 py-1.5 align-top font-medium tabnum text-[11px] text-muted-foreground">
                    {t}
                  </td>
                  {DAYS.map((_, day) => {
                    const cell = grid[`${day}-${t}`] ?? [];
                    return (
                      <td
                        key={day}
                        className={cn(
                          'min-w-[140px] border-r border-t border-border px-1.5 py-1 align-top',
                          cell.length === 0 && 'border-dashed bg-card',
                        )}
                      >
                        <AnimatePresence>
                          {cell.map((s, idx) => {
                            const c = colorForSubject(s.subjectId);
                            const conflict = conflictSubjects.has(s.subjectId);
                            return (
                              <motion.div
                                key={s.id}
                                initial={{ opacity: 0, y: -3 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                transition={{ delay: idx * 0.04 }}
                                className={cn(
                                  'mb-1 rounded border-l-2 px-1.5 py-1 last:mb-0',
                                  conflict && 'animate-pulse-ring',
                                )}
                                style={{ backgroundColor: c.bg, borderLeftColor: c.accent }}
                              >
                                <div className="truncate text-[11px] font-medium text-foreground">
                                  {s.subject?.name ?? s.subjectId}
                                </div>
                                <div className="truncate text-[10px] text-muted-foreground">
                                  {s.section?.name ?? '—'} · {s.room?.name ?? '—'}
                                </div>
                                {s.doctor?.user?.name && (
                                  <div className="truncate text-[10px] text-muted-foreground/80">
                                    {s.doctor.user.name}
                                  </div>
                                )}
                              </motion.div>
                            );
                          })}
                        </AnimatePresence>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {/* Modals */}
      <ConfirmModal
        open={confirmGenerate}
        onOpenChange={setConfirmGenerate}
        title="Auto-generate schedule?"
        description="The conflict-free planner will write fresh slots, replacing the current week's draft."
        confirmLabel="Generate"
        onConfirm={() => generateMu.mutate()}
        busy={generateMu.isPending}
      />
      <ConfirmModal
        open={confirmPublish}
        onOpenChange={setConfirmPublish}
        title="Publish schedule?"
        description="Once published, students and doctors will see the new slots immediately."
        confirmLabel="Publish"
        onConfirm={() => publishMu.mutate()}
        busy={publishMu.isPending}
      />
    </>
  );
}
