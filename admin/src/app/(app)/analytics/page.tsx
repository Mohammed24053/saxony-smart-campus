"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui";
import { api, unwrap } from "@/lib/api";
import { PageHeader, CardSkeleton } from "@/components/seu";
import { SEU } from "@/lib/seu-theme";

type RoomUtil = { roomName: string; utilizationRate: number };
type DoctorPerf = { doctorName: string; presentRate: number };

const tooltipStyle: React.CSSProperties = {
  borderRadius: 8,
  border: "1px solid rgba(49,49,59,0.10)",
  boxShadow: "0 1px 2px rgba(49,49,59,0.04)",
  fontSize: 11,
  padding: "6px 8px",
};

export default function AnalyticsPage() {
  const rooms = useQuery({
    queryKey: ["analytics", "rooms"],
    queryFn: () => unwrap<RoomUtil[]>(api.get("/analytics/rooms")),
  });
  const doctors = useQuery({
    queryKey: ["analytics", "doctors"],
    queryFn: () => unwrap<DoctorPerf[]>(api.get("/analytics/doctors")),
  });

  return (
    <>
      <PageHeader
        title="Analytics"
        description="Cross-cutting dashboards on rooms, doctors, and trends."
      />

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Room utilization</CardTitle>
            <CardDescription>
              Bookings vs available time, by room (%)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {rooms.isLoading ? (
              <CardSkeleton rows={3} />
            ) : (
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={rooms.data ?? []}
                    margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid
                      vertical={false}
                      stroke={SEU.gray}
                      strokeOpacity={0.12}
                      strokeDasharray="3 3"
                    />
                    <XAxis
                      dataKey="roomName"
                      tickLine={false}
                      axisLine={false}
                      stroke={SEU.gray}
                      fontSize={10}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tickLine={false}
                      axisLine={false}
                      stroke={SEU.gray}
                      fontSize={10}
                      tickFormatter={(v) => `${v}%`}
                      width={28}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(v: number) => [`${v}%`, "Utilization"]}
                    />
                    <Bar
                      dataKey="utilizationRate"
                      radius={[3, 3, 0, 0]}
                      animationDuration={800}
                      barSize={20}
                    >
                      {(rooms.data ?? []).map((_, i) => (
                        <Cell key={i} fill={SEU.red} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Doctor presence</CardTitle>
            <CardDescription>
              Lecture-show-up rate, by doctor (%)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {doctors.isLoading ? (
              <CardSkeleton rows={3} />
            ) : (
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={doctors.data ?? []}
                    margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid
                      vertical={false}
                      stroke={SEU.gray}
                      strokeOpacity={0.12}
                      strokeDasharray="3 3"
                    />
                    <XAxis
                      dataKey="doctorName"
                      tickLine={false}
                      axisLine={false}
                      stroke={SEU.gray}
                      fontSize={10}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tickLine={false}
                      axisLine={false}
                      stroke={SEU.gray}
                      fontSize={10}
                      tickFormatter={(v) => `${v}%`}
                      width={28}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(v: number) => [`${v}%`, "Present"]}
                    />
                    <Bar
                      dataKey="presentRate"
                      radius={[3, 3, 0, 0]}
                      animationDuration={800}
                      barSize={20}
                    >
                      {(doctors.data ?? []).map((_, i) => (
                        <Cell key={i} fill={SEU.gold} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
