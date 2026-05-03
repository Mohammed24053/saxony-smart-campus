'use client';

import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui';
import { api, unwrap } from '@/lib/api';
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

type RoomUtil = { roomName: string; utilizationRate: number };
type DoctorPerf = { doctorName: string; presentRate: number };

export default function AnalyticsPage() {
  const rooms = useQuery({
    queryKey: ['analytics', 'rooms'],
    queryFn: () => unwrap<RoomUtil[]>(api.get('/analytics/rooms')),
  });
  const doctors = useQuery({
    queryKey: ['analytics', 'doctors'],
    queryFn: () => unwrap<DoctorPerf[]>(api.get('/analytics/doctors')),
  });
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">Analytics</h1>
      <Card className="p-6">
        <h2 className="mb-4 text-lg font-semibold">Room utilization (%)</h2>
        <div className="h-64">
          <ResponsiveContainer>
            <BarChart data={rooms.data ?? []}>
              <CartesianGrid stroke="#eee" strokeDasharray="3 3" />
              <XAxis dataKey="roomName" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Bar dataKey="utilizationRate" fill="hsl(var(--primary))" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Card className="p-6">
        <h2 className="mb-4 text-lg font-semibold">Doctor presence rate (%)</h2>
        <div className="h-64">
          <ResponsiveContainer>
            <BarChart data={doctors.data ?? []}>
              <CartesianGrid stroke="#eee" strokeDasharray="3 3" />
              <XAxis dataKey="doctorName" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Bar dataKey="presentRate" fill="hsl(var(--primary))" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
