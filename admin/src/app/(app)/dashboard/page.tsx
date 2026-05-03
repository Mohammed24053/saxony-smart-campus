'use client';

import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui';
import { api, unwrap } from '@/lib/api';
import {
  LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';

type Dashboard = {
  students: number;
  doctors: number;
  sections: number;
  rooms: number;
  atRiskOpen: number;
  sessionsToday: number;
  presentToday: number;
};

type ChartPoint = { date: string; rate: number };

export default function DashboardPage() {
  const totalsQ = useQuery({
    queryKey: ['analytics', 'dashboard'],
    queryFn: () => unwrap<Dashboard>(api.get('/analytics/dashboard')),
  });
  const chartQ = useQuery({
    queryKey: ['analytics', 'chart'],
    queryFn: () => unwrap<ChartPoint[]>(api.get('/analytics/attendance/chart')),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Welcome to the Saxony Smart Campus admin console.</p>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Students" value={totalsQ.data?.students} />
        <Stat label="Doctors" value={totalsQ.data?.doctors} />
        <Stat label="Rooms" value={totalsQ.data?.rooms} />
        <Stat label="Sessions today" value={totalsQ.data?.sessionsToday} />
        <Stat label="Sections" value={totalsQ.data?.sections} />
        <Stat label="Present today" value={totalsQ.data?.presentToday} />
        <Stat label="At-risk (open)" value={totalsQ.data?.atRiskOpen} />
      </div>
      <Card className="p-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Attendance — last 14 days</h2>
          <p className="text-sm text-muted-foreground">Daily presence rate (%)</p>
        </div>
        <div className="h-72">
          <ResponsiveContainer>
            <LineChart data={chartQ.data ?? []}>
              <CartesianGrid stroke="#eee" strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Line type="monotone" dataKey="rate" stroke="hsl(var(--primary))" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value?: number }) {
  return (
    <Card className="p-5">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-1 text-3xl font-semibold">{value ?? '—'}</div>
    </Card>
  );
}
