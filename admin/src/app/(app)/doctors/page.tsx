'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { api, unwrapPaginated } from '@/lib/api';
import { Button, Card, Input, Table, Td, Th, Tr } from '@/components/ui';
import { PageHeader, TableSkeleton } from '@/components/seu';

type Doctor = { id: string; doctorId: string; name: string; email?: string };

export default function DoctorsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const q = useQuery({
    queryKey: ['doctors', page, search],
    queryFn: () => unwrapPaginated<Doctor>(api.get('/doctors', { params: { page, pageSize: 25, search } })),
  });
  return (
    <>
      <PageHeader title="Doctors" description="Faculty and instructional staff." />
      <Card className="mb-4 p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, ID, email…"
            className="pl-9"
            value={search}
            onChange={(e) => { setPage(1); setSearch(e.target.value); }}
          />
        </div>
      </Card>
      {q.isLoading ? (
        <TableSkeleton rows={5} cols={3} />
      ) : (
        <Table>
          <thead><tr><Th>Doctor ID</Th><Th>Name</Th><Th>Email</Th></tr></thead>
          <tbody>
            {q.data?.items.map((d, i) => (
              <Tr key={d.id} index={i}>
                <Td className="font-mono text-xs text-muted-foreground">{d.doctorId}</Td>
                <Td className="font-medium">{d.name}</Td>
                <Td>{d.email ?? '—'}</Td>
              </Tr>
            ))}
            {q.data?.items.length === 0 && (
              <tr><Td className="text-muted-foreground">No doctors yet.</Td><Td /><Td /></tr>
            )}
          </tbody>
        </Table>
      )}
      {q.data && (
        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <span>{q.data.total} total</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page * q.data.pageSize >= q.data.total} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      )}
    </>
  );
}
