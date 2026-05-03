'use client';

import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import { Button, Card } from '@/components/ui';

type Slot = {
  id: string; subjectId: string; sectionId: string; doctorId: string; roomId: string;
  dayOfWeek: number; startTime: string; endTime: string;
  subject?: { name: string }; doctor?: { user?: { name: string } };
  room?: { name: string }; section?: { name: string };
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function SchedulePage() {
  const qc = useQueryClient();
  const slotsQ = useQuery({
    queryKey: ['schedule'],
    queryFn: () => unwrap<{ slots: Slot[] }>(api.get('/schedule')),
  });
  const generateMu = useMutation({
    mutationFn: () => api.post('/schedule/generate'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['schedule'] }),
  });
  const conflictsQ = useQuery({
    queryKey: ['schedule', 'conflicts'],
    queryFn: () => unwrap<{ items: { reason: string; subjectId: string }[] }>(api.get('/schedule/conflicts')),
  });

  const grid = useMemo(() => {
    const cells: Record<string, Slot[]> = {};
    (slotsQ.data?.slots ?? []).forEach((s) => {
      const key = `${s.dayOfWeek}-${s.startTime}`;
      cells[key] = [...(cells[key] ?? []), s];
    });
    return cells;
  }, [slotsQ.data]);

  const hours = Array.from({ length: 11 }, (_, i) => 8 + i);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Schedule</h1>
          <p className="text-sm text-muted-foreground">{slotsQ.data?.slots.length ?? 0} scheduled slots</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => generateMu.mutate()} disabled={generateMu.isPending}>
            {generateMu.isPending ? 'Generating…' : 'Auto-generate'}
          </Button>
          <Button variant="outline" onClick={() => api.post('/schedule/publish').then(() => qc.invalidateQueries())}>
            Publish
          </Button>
        </div>
      </div>
      {conflictsQ.data && conflictsQ.data.items.length > 0 && (
        <Card className="border-destructive/30 bg-destructive/5 p-4">
          <div className="font-semibold text-destructive">{conflictsQ.data.items.length} conflicts</div>
          <ul className="mt-2 list-disc pl-6 text-sm text-destructive/90">
            {conflictsQ.data.items.slice(0, 5).map((c, i) => (
              <li key={i}>{c.reason} — subject {c.subjectId}</li>
            ))}
          </ul>
        </Card>
      )}
      <Card className="overflow-auto p-0">
        <table className="w-full text-xs">
          <thead className="bg-muted/40">
            <tr>
              <th className="border-r border-border px-2 py-2">Time</th>
              {DAYS.map((d) => <th key={d} className="border-r border-border px-2 py-2">{d}</th>)}
            </tr>
          </thead>
          <tbody>
            {hours.map((h) => {
              const t = `${String(h).padStart(2, '0')}:00`;
              return (
                <tr key={h}>
                  <td className="border-r border-t border-border px-2 py-2 font-medium text-muted-foreground">{t}</td>
                  {DAYS.map((_, day) => {
                    const cell = grid[`${day}-${t}`] ?? [];
                    return (
                      <td key={day} className="min-w-[140px] border-r border-t border-border px-2 py-2 align-top">
                        {cell.map((s) => (
                          <div key={s.id} className="mb-1 rounded bg-primary/10 p-1">
                            <div className="font-medium">{s.subject?.name ?? s.subjectId}</div>
                            <div className="text-muted-foreground">{s.section?.name} · {s.room?.name}</div>
                          </div>
                        ))}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
