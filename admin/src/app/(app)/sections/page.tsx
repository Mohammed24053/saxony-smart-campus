'use client';

import { useQuery } from '@tanstack/react-query';
import { api, unwrapPaginated } from '@/lib/api';
import { Table, Td, Th, Tr } from '@/components/ui';
import { PageHeader, TableSkeleton } from '@/components/seu';

type Section = {
  id: string; name: string; faculty?: string; year?: number; capacity?: number;
};

export default function SectionsPage() {
  const q = useQuery({
    queryKey: ['sections'],
    queryFn: () => unwrapPaginated<Section>(api.get('/sections', { params: { page: 1, pageSize: 100 } })),
  });
  return (
    <>
      <PageHeader title="Sections" description="Cohort divisions per year and faculty." />
      {q.isLoading ? (
        <TableSkeleton rows={6} cols={4} />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Name</Th><Th>Faculty</Th><Th>Year</Th><Th>Capacity</Th>
            </tr>
          </thead>
          <tbody>
            {q.data?.items.map((s, i) => (
              <Tr key={s.id} index={i}>
                <Td className="font-medium">{s.name}</Td>
                <Td className="text-muted-foreground">{s.faculty ?? '—'}</Td>
                <Td className="tabular-nums">{s.year ?? '—'}</Td>
                <Td className="tabular-nums">{s.capacity ?? '—'}</Td>
              </Tr>
            ))}
            {q.data?.items.length === 0 && (
              <tr><Td className="text-muted-foreground">No sections yet.</Td><Td /><Td /><Td /></tr>
            )}
          </tbody>
        </Table>
      )}
    </>
  );
}
