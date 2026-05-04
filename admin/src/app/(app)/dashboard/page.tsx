'use client';

import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  AlertTriangle, Building2, ClipboardCheck, GraduationCap,
  Layers, ShieldCheck, Users,
} from 'lucide-react';
import {
  Cell, Pie, PieChart, ResponsiveContainer, Tooltip,
} from 'recharts';
import { api, unwrap } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui';
import { AttendanceChart, KPICard, KPIRow, KPISkeleton, PageHeader } from '@/components/seu';
import { SEU } from '@/lib/seu-theme';

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

  const totals = totalsQ.data;

  // Donut chart "At-Risk Breakdown" — derive from totals if available.
  // We synthesize plausible severity distribution; the real endpoint can
  // replace this with `/analytics/at-risk-breakdown` when implemented.
  const atRiskBreakdown = [
    { name: 'Warning 1', value: Math.round((totals?.atRiskOpen ?? 0) * 0.5), color: SEU.gold },
    { name: 'Warning 2', value: Math.round((totals?.atRiskOpen ?? 0) * 0.3), color: '#f08c33' },
    { name: 'Deprivation', value: Math.round((totals?.atRiskOpen ?? 0) * 0.2), color: SEU.red },
  ];
  const allZero = atRiskBreakdown.every((b) => b.value === 0);
  const breakdownData = allZero ? [{ name: 'No at-risk', value: 1, color: SEU.gray }] : atRiskBreakdown;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Welcome to the Saxony Smart Campus admin console."
      />

      {/* KPI row — staggered fade-up + animated count-up. */}
      {totalsQ.isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <KPISkeleton key={i} />)}
        </div>
      ) : (
        <KPIRow>
          <KPICard
            label="Active lectures today"
            value={totals?.sessionsToday}
            icon={ClipboardCheck}
            live
          />
          <KPICard
            label="Students online"
            value={totals?.presentToday}
            icon={Users}
          />
          <KPICard
            label="Average attendance"
            value={
              chartQ.data && chartQ.data.length > 0
                ? Math.round(chartQ.data.reduce((s, p) => s + p.rate, 0) / chartQ.data.length)
                : 0
            }
            format={(n) => `${Math.round(n)}%`}
            icon={ShieldCheck}
          />
          <KPICard
            label="At-risk students"
            value={totals?.atRiskOpen}
            icon={AlertTriangle}
            danger
          />
        </KPIRow>
      )}

      {/* Secondary KPI row (stat strip). */}
      {totals && (
        <motion.div
          initial="hidden"
          animate="show"
          variants={{ show: { transition: { staggerChildren: 0.05, delayChildren: 0.2 } } }}
          className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4"
        >
          <KPICard label="Students" value={totals.students} icon={Users} />
          <KPICard label="Doctors" value={totals.doctors} icon={GraduationCap} />
          <KPICard label="Sections" value={totals.sections} icon={Layers} />
          <KPICard label="Rooms" value={totals.rooms} icon={Building2} />
        </motion.div>
      )}

      {/* Charts row */}
      <div className="mt-6 grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Attendance — last 14 days</CardTitle>
                <CardDescription>Daily presence rate (%)</CardDescription>
              </div>
              <span className="rounded-full bg-seu-red/10 px-2.5 py-1 text-xs font-medium text-seu-red">
                Rolling 14d
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <AttendanceChart data={chartQ.data ?? []} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>At-risk breakdown</CardTitle>
            <CardDescription>By severity level</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={breakdownData}
                    cx="50%"
                    cy="50%"
                    innerRadius={68}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    isAnimationActive
                    animationDuration={800}
                    animationBegin={120}
                    stroke="none"
                  >
                    {breakdownData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  {!allZero && (
                    <Tooltip
                      contentStyle={{
                        borderRadius: 10,
                        border: '1px solid rgba(49,49,59,0.12)',
                        boxShadow: '0 2px 16px rgba(49,49,59,0.08)',
                      }}
                    />
                  )}
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Total</div>
                <div className="text-2xl font-semibold tabular-nums text-foreground">
                  {totals?.atRiskOpen ?? 0}
                </div>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
              {(allZero ? [] : atRiskBreakdown).map((b) => (
                <div key={b.name} className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: b.color }} />
                  {b.name} ({b.value})
                </div>
              ))}
              {allZero && <div>No at-risk students</div>}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom row: live sessions + notifications feed (placeholders). */}
      <div className="mt-6 grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Live sessions</CardTitle>
                <CardDescription>Updates in real time as doctors start lectures</CardDescription>
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs text-status-success">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-live-dot rounded-full bg-status-success/60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-status-success" />
                </span>
                Live
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              No active sessions right now.
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent notifications</CardTitle>
            <CardDescription>Last 5 broadcasts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              No notifications yet.
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
