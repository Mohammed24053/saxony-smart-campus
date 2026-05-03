'use client';

import { useQuery } from '@tanstack/react-query';
import { api, unwrap, type Paginated } from '@/lib/api';
import { Card, Table, Td, Th } from '@/components/ui';

type Room = {
  id: string; name: string; type: string; capacity: number;
  building?: string; floor?: number; gpsEnabled: boolean;
};

export default function RoomsPage() {
  const q = useQuery({
    queryKey: ['rooms'],
    queryFn: () => unwrap<Paginated<Room>>(api.get('/rooms', { params: { page: 1, pageSize: 100 } })),
  });
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">Rooms</h1>
      <Card className="p-0">
        <Table>
          <thead>
            <tr><Th>Name</Th><Th>Type</Th><Th>Capacity</Th><Th>Building</Th><Th>GPS</Th></tr>
          </thead>
          <tbody>
            {q.data?.items.map((r) => (
              <tr key={r.id}>
                <Td>{r.name}</Td>
                <Td>{r.type}</Td>
                <Td>{r.capacity}</Td>
                <Td>{r.building ? `${r.building}${r.floor != null ? ` / F${r.floor}` : ''}` : '—'}</Td>
                <Td>{r.gpsEnabled ? 'On' : 'Off'}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
