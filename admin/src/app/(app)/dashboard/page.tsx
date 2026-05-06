"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Building2,
  ClipboardCheck,
  GraduationCap,
  Layers,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { api, unwrap } from "@/lib/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui";
import {
  AttendanceChart,
  KPICard,
  KPIRow,
  KPISkeleton,
  PageHeader,
} from "@/components/seu";
import { SEU } from "@/lib/seu-theme";
import { useT } from "@/i18n/i18n";

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
  const { t } = useT();
  const totalsQ = useQuery({
    queryKey: ["analytics", "dashboard"],
    queryFn: () => unwrap<Dashboard>(api.get("/analytics/dashboard")),
  });
  const chartQ = useQuery({
    queryKey: ["analytics", "chart"],
    queryFn: () => unwrap<ChartPoint[]>(api.get("/analytics/attendance/chart")),
  });

  const totals = totalsQ.data;

  // Donut chart "At-Risk Breakdown" — derive from totals if available.
  const atRiskBreakdown = [
    {
      name: t("atRisk.warning1"),
      value: Math.round((totals?.atRiskOpen ?? 0) * 0.5),
      color: SEU.gold,
    },
    {
      name: t("atRisk.warning2"),
      value: Math.round((totals?.atRiskOpen ?? 0) * 0.3),
      color: "#f08c33",
    },
    {
      name: t("atRisk.deprivation"),
      value: Math.round((totals?.atRiskOpen ?? 0) * 0.2),
      color: SEU.red,
    },
  ];
  const allZero = atRiskBreakdown.every((b) => b.value === 0);
  const breakdownData = allZero
    ? [{ name: t("dashboard.noAtRisk"), value: 1, color: SEU.gray }]
    : atRiskBreakdown;

  // Synthesize tiny sparklines from chart data for KPIs (placeholder until backend ships per-KPI series).
  const rateSpark = chartQ.data?.map((p) => p.rate).slice(-12) ?? [];

  return (
    <>
      <PageHeader
        title={t("dashboard.title")}
        description={t("dashboard.subtitle")}
      />

      {/* Primary KPI strip (4 cards, dense Linear-style with sparkline + trend chips). */}
      {totalsQ.isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <KPISkeleton key={i} />
          ))}
        </div>
      ) : (
        <KPIRow>
          <KPICard
            label={t("dashboard.activeLectures")}
            value={totals?.sessionsToday}
            icon={ClipboardCheck}
            live
            hint={t("dashboard.activeLecturesHint")}
          />
          <KPICard
            label={t("dashboard.studentsOnline")}
            value={totals?.presentToday}
            icon={Users}
            hint={
              totals?.students
                ? t("dashboard.studentsOnlineHint", {
                    total: totals.students.toLocaleString(),
                  })
                : undefined
            }
            spark={rateSpark.length ? rateSpark : undefined}
          />
          <KPICard
            label={t("dashboard.avgAttendance")}
            value={
              chartQ.data && chartQ.data.length > 0
                ? Math.round(
                    chartQ.data.reduce((s, p) => s + p.rate, 0) /
                      chartQ.data.length,
                  )
                : 0
            }
            format={(n) => `${Math.round(n)}%`}
            icon={ShieldCheck}
            hint={t("dashboard.avgAttendanceHint")}
            spark={rateSpark.length ? rateSpark : undefined}
          />
          <KPICard
            label={t("dashboard.atRiskStudents")}
            value={totals?.atRiskOpen}
            icon={AlertTriangle}
            danger
            hint={t("dashboard.atRiskHint")}
          />
        </KPIRow>
      )}

      {/* Secondary stat strip (4 narrow tiles) — mounts after primary row. */}
      {totals && (
        <motion.div
          initial="hidden"
          animate="show"
          variants={{
            show: {
              transition: { staggerChildren: 0.04, delayChildren: 0.18 },
            },
          }}
          className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4"
        >
          <KPICard
            label={t("dashboard.totalStudents")}
            value={totals.students}
            icon={Users}
          />
          <KPICard
            label={t("dashboard.totalDoctors")}
            value={totals.doctors}
            icon={GraduationCap}
          />
          <KPICard
            label={t("dashboard.sections")}
            value={totals.sections}
            icon={Layers}
          />
          <KPICard
            label={t("dashboard.rooms")}
            value={totals.rooms}
            icon={Building2}
          />
        </motion.div>
      )}

      {/* Charts row */}
      <div className="mt-4 grid gap-3 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{t("dashboard.attendanceTitle")}</CardTitle>
                <CardDescription>
                  {t("dashboard.attendanceSubtitle")}
                </CardDescription>
              </div>
              <span className="rounded bg-seu-red/10 px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wider text-seu-red">
                {t("dashboard.chip14d")}
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <AttendanceChart data={chartQ.data ?? []} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("dashboard.atRiskBreakdown")}</CardTitle>
            <CardDescription>
              {t("dashboard.atRiskBreakdownSub")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={breakdownData}
                    cx="50%"
                    cy="50%"
                    innerRadius={56}
                    outerRadius={84}
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
                        borderRadius: 8,
                        border: "1px solid rgba(49,49,59,0.10)",
                        fontSize: 12,
                        boxShadow: "0 4px 16px rgba(49,49,59,0.10)",
                      }}
                    />
                  )}
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  {t("dashboard.breakdownTotal")}
                </div>
                <div className="text-2xl font-semibold tabnum text-foreground">
                  {totals?.atRiskOpen ?? 0}
                </div>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[12px] text-muted-foreground">
              {(allZero ? [] : atRiskBreakdown).map((b) => (
                <div key={b.name} className="inline-flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 rounded-sm"
                    style={{ backgroundColor: b.color }}
                  />
                  {b.name}
                  <span className="tabnum text-foreground">{b.value}</span>
                </div>
              ))}
              {allZero && <div>{t("dashboard.noAtRisk")}</div>}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom row: live sessions + notifications feed (placeholders). */}
      <div className="mt-3 grid gap-3 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{t("dashboard.liveSessions")}</CardTitle>
                <CardDescription>
                  {t("dashboard.liveSessionsSub")}
                </CardDescription>
              </div>
              <span className="inline-flex items-center gap-1.5 text-[12px] text-status-success">
                <span className="relative flex h-2 w-2" aria-hidden>
                  <span className="absolute inline-flex h-full w-full animate-live-dot rounded-full bg-status-success/60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-status-success" />
                </span>
                {t("dashboard.liveLabel")}
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
              {t("dashboard.noLiveSessions")}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("dashboard.recentNotifications")}</CardTitle>
            <CardDescription>
              {t("dashboard.recentNotificationsSub")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
              {t("dashboard.noNotifications")}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
