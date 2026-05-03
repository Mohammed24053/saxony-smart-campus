'use client';

import { useQuery } from '@tanstack/react-query';
import { api, unwrapPaginated } from '@/lib/api';
import { Card, Table, Td, Th } from '@/components/ui';

type Section = {
  id: string; name: string; faculty?: string; year?: number; capacity?: number;
};

export default function SectionsPage() {
  const q = useQuery({
    queryKey: ['sections'],
    queryFn: () => unwrapPaginated<Section>(api.get('/sections', { params: { page: 1, pageSize: 100 } })),
  });
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">Sections</h1>
      <Card className="p-0">
        <Table>
          <thead>
            <tr><Th>Name</Th><Th>Faculty</Th><Th>Year</Th><Th>Capacity</Th></tr>
          </thead>
          <tbody>
            {q.data?.items.map((s) => (
              <tr key={s.id}>
                <Td>{s.name}</Td><Td>{s.faculty ?? '—'}</Td>
                <Td>{s.year ?? '—'}</Td><Td>{s.capacity ?? '—'}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
