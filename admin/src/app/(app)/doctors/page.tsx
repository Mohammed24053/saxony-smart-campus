'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { api, unwrapPaginated } from '@/lib/api';
import { Button, Input, Td, Th, Toolbar, Tr } from '@/components/ui';
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

      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-card">
        <Toolbar>
          <div className="relative max-w-xs flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name, ID, email…"
              className="h-8 pl-8 text-[12.5px]"
              value={search}
              onChange={(e) => { setPage(1); setSearch(e.target.value); }}
            />
          </div>
          {q.data && (
            <span className="ml-auto text-[11px] tabnum text-muted-foreground">
              {q.data.total.toLocaleString()} total
            </span>
          )}
        </Toolbar>
        {q.isLoading ? (
          <TableSkeleton rows={5} cols={3} />
        ) : (
          <table className="w-full text-sm">
            <thead><tr><Th>Doctor ID</Th><Th>Name</Th><Th>Email</Th></tr></thead>
            <tbody>
              {q.data?.items.map((d, i) => (
                <Tr key={d.id} index={i}>
                  <Td className="font-mono tabnum text-[11.5px] text-muted-foreground">{d.doctorId}</Td>
                  <Td className="font-medium">{d.name}</Td>
                  <Td className="text-[12.5px]">{d.email ?? '—'}</Td>
                </Tr>
              ))}
              {q.data?.items.length === 0 && (
                <tr><Td className="text-center text-muted-foreground">No doctors yet.</Td><Td /><Td /></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {q.data && (
        <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="tabnum">{q.data.total} total</span>
          <div className="flex gap-1.5">
            <Button variant="outline" size="xs" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <Button variant="outline" size="xs" disabled={page * q.data.pageSize >= q.data.total} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      )}
    </>
  );
}
