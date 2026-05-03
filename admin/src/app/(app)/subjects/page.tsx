'use client';

import { useQuery } from '@tanstack/react-query';
import { api, unwrapPaginated } from '@/lib/api';
import { Card, Table, Td, Th } from '@/components/ui';

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
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">Subjects</h1>
      <Card className="p-0">
        <Table>
          <thead>
            <tr><Th>Code</Th><Th>Name</Th><Th>Faculty</Th><Th>Type</Th><Th>Hours/wk</Th></tr>
          </thead>
          <tbody>
            {q.data?.items.map((s) => (
              <tr key={s.id}>
                <Td>{s.code}</Td><Td>{s.name}</Td><Td>{s.faculty ?? '—'}</Td>
                <Td>{s.type}</Td><Td>{s.hoursPerWeek ?? '—'}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
