'use client';

import { useQuery } from '@tanstack/react-query';
import { api, unwrapPaginated } from '@/lib/api';
import { Card, Table, Td, Th } from '@/components/ui';

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

const LEVEL_LABEL: Record<string, string> = {
  warning_1: 'Warning 1',
  warning_2: 'Warning 2',
  deprivation: 'Deprivation',
};

export default function AtRiskPage() {
  const q = useQuery({
    queryKey: ['at-risk'],
    queryFn: () => unwrapPaginated<AtRiskRecord>(api.get('/at-risk', { params: { page: 1, pageSize: 100 } })),
  });
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">At-Risk Students</h1>
      <Card className="p-0">
        <Table>
          <thead>
            <tr><Th>Student</Th><Th>Subject</Th><Th>Level</Th><Th>Absences</Th><Th>Triggered</Th><Th>Status</Th></tr>
          </thead>
          <tbody>
            {q.data?.items.map((r) => (
              <tr key={r.id}>
                <Td>{r.student?.user.name ?? r.studentId}</Td>
                <Td>{r.subject ? `${r.subject.code} — ${r.subject.name}` : r.subjectId}</Td>
                <Td>
                  <span
                    className={
                      r.warningLevel === 'deprivation'
                        ? 'rounded bg-red-100 px-2 py-1 text-xs text-red-800'
                        : r.warningLevel === 'warning_2'
                        ? 'rounded bg-amber-100 px-2 py-1 text-xs text-amber-800'
                        : 'rounded bg-yellow-50 px-2 py-1 text-xs text-yellow-800'
                    }
                  >
                    {LEVEL_LABEL[r.warningLevel] ?? r.warningLevel}
                  </span>
                </Td>
                <Td>{r.absenceCount}</Td>
                <Td>{new Date(r.triggeredAt).toLocaleDateString()}</Td>
                <Td>{r.isResolved ? 'Resolved' : 'Active'}</Td>
              </tr>
            ))}
            {q.data?.items.length === 0 && (
              <tr><Td className="text-muted-foreground">No at-risk students.</Td><Td /><Td /><Td /><Td /><Td /></tr>
            )}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
