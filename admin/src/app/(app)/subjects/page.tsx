'use client';

import { useQuery } from '@tanstack/react-query';
import { api, unwrapPaginated } from '@/lib/api';
import { Table, Td, Th, Tr } from '@/components/ui';
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
      {q.isLoading ? (
        <TableSkeleton rows={6} cols={5} />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Code</Th><Th>Name</Th><Th>Faculty</Th><Th>Type</Th><Th>Hours/wk</Th>
            </tr>
          </thead>
          <tbody>
            {q.data?.items.map((s, i) => (
              <Tr key={s.id} index={i}>
                <Td className="font-mono text-xs">{s.code}</Td>
                <Td className="font-medium">{s.name}</Td>
                <Td className="text-muted-foreground">{s.faculty ?? '—'}</Td>
                <Td className="text-muted-foreground">{s.type}</Td>
                <Td className="tabular-nums">{s.hoursPerWeek ?? '—'}</Td>
              </Tr>
            ))}
            {q.data?.items.length === 0 && (
              <tr><Td className="text-muted-foreground">No subjects yet.</Td><Td /><Td /><Td /><Td /></tr>
            )}
          </tbody>
        </Table>
      )}
    </>
  );
}
