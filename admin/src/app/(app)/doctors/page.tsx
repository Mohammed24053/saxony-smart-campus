'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, unwrapPaginated } from '@/lib/api';
import { Button, Card, Input, Table, Td, Th } from '@/components/ui';

type Doctor = {
  id: string; doctorId: string; name: string; email?: string;
};

export default function DoctorsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const q = useQuery({
    queryKey: ['doctors', page, search],
    queryFn: () => unwrapPaginated<Doctor>(api.get('/doctors', { params: { page, pageSize: 25, search } })),
  });
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">Doctors</h1>
      <Card className="p-4">
        <Input placeholder="Search…" value={search} onChange={(e) => { setPage(1); setSearch(e.target.value); }} />
      </Card>
      <Table>
        <thead><tr><Th>Doctor ID</Th><Th>Name</Th><Th>Email</Th></tr></thead>
        <tbody>
          {q.data?.items.map((d) => (
            <tr key={d.id}><Td>{d.doctorId}</Td><Td>{d.name}</Td><Td>{d.email ?? '—'}</Td></tr>
          ))}
          {q.data?.items.length === 0 && <tr><Td className="text-muted-foreground">No doctors yet.</Td><Td /><Td /></tr>}
        </tbody>
      </Table>
      {q.data && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{q.data.total} total</span>
          <div className="flex gap-2">
            <Button variant="outline" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <Button variant="outline" disabled={page * q.data.pageSize >= q.data.total} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}
