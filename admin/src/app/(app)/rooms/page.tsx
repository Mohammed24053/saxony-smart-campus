'use client';

import { useQuery } from '@tanstack/react-query';
import { MapPin } from 'lucide-react';
import { api, unwrapPaginated } from '@/lib/api';
import { Td, Th, Toolbar, Tr } from '@/components/ui';
import { PageHeader, TableSkeleton } from '@/components/seu';

type Room = {
  id: string; name: string; type: string; capacity: number;
  building?: string; floor?: number; gpsEnabled: boolean;
};

export default function RoomsPage() {
  const q = useQuery({
    queryKey: ['rooms'],
    queryFn: () => unwrapPaginated<Room>(api.get('/rooms', { params: { page: 1, pageSize: 100 } })),
  });
  return (
    <>
      <PageHeader title="Rooms" description="Physical learning spaces and their capacities." />
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
                <Th>Name</Th><Th>Type</Th><Th className="text-right">Capacity</Th><Th>Building</Th><Th>GPS</Th>
              </tr>
            </thead>
            <tbody>
              {q.data?.items.map((r, i) => (
                <Tr key={r.id} index={i}>
                  <Td className="font-medium">{r.name}</Td>
                  <Td className="text-[12.5px] text-muted-foreground">{r.type}</Td>
                  <Td className="tabnum text-right text-[12.5px]">{r.capacity}</Td>
                  <Td className="text-[12.5px] text-muted-foreground">
                    {r.building ? `${r.building}${r.floor != null ? ` / F${r.floor}` : ''}` : '—'}
                  </Td>
                  <Td>
                    {r.gpsEnabled ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-status-success">
                        <MapPin className="h-3 w-3" /> On
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        <MapPin className="h-3 w-3" /> Off
                      </span>
                    )}
                  </Td>
                </Tr>
              ))}
              {q.data?.items.length === 0 && (
                <tr><Td className="text-center text-muted-foreground">No rooms yet.</Td><Td /><Td /><Td /><Td /></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
