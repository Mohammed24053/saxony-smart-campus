'use client';

import { useQuery } from '@tanstack/react-query';
import { api, unwrapPaginated } from '@/lib/api';
import { Td, Th, Toolbar, Tr } from '@/components/ui';
import { PageHeader, TableSkeleton } from '@/components/seu';

type Subject = {
  id: string; code: string; name: string; type: string;
  hoursPerWeek?: number; faculty?: string;
};

export default function SubjectsPage() {
  const q = useQuery({
    queryKey: ['subjects'],
    queryFn: () => unwrapPaginated<Subject>(api.get('/subjects', { params: { page: 1, pageSize: 100 } })),
  });
  return (
    <>
      <PageHeader title="Subjects" description="Courses available across the catalogue." />
      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-card">
        <Toolbar>
          {q.data && (
            <span className="ml-auto text-[11px] tabnum text-muted-foreground">
              {q.data.total.toLocaleString()} total
            </span>
          )}
        </Toolbar>
        {q.isLoading ? (
          <TableSkeleton rows={6} cols={5} />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr>
                <Th>Code</Th><Th>Name</Th><Th>Faculty</Th><Th>Type</Th><Th className="text-right">Hours/wk</Th>
              </tr>
            </thead>
            <tbody>
              {q.data?.items.map((s, i) => (
                <Tr key={s.id} index={i}>
                  <Td className="font-mono tabnum text-[11.5px] text-muted-foreground">{s.code}</Td>
                  <Td className="font-medium">{s.name}</Td>
                  <Td className="text-[12.5px] text-muted-foreground">{s.faculty ?? '—'}</Td>
                  <Td className="text-[12.5px] text-muted-foreground">{s.type}</Td>
                  <Td className="tabnum text-right text-[12.5px]">{s.hoursPerWeek ?? '—'}</Td>
                </Tr>
              ))}
              {q.data?.items.length === 0 && (
                <tr><Td className="text-center text-muted-foreground">No subjects yet.</Td><Td /><Td /><Td /><Td /></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
