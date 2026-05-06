"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SEU } from "@/lib/seu-theme";

export interface AttendanceChartProps {
  /** Sorted [{ date: 'YYYY-MM-DD', rate: 0–100 }, ...]. */
  data: { date: string; rate: number }[];
  height?: number;
}

/**
 * Brand-coloured attendance trend (Round 2 — denser axis, smaller fonts).
 * Recharts re-runs its line-draw animation on each data update, which gives
 * us the spec's "line draws itself" effect for free at mount time.
 */
export function AttendanceChart({ data, height = 220 }: AttendanceChartProps) {
  const formatted = useMemo(
    () => data.map((d) => ({ ...d, date: d.date?.slice(5) ?? "" })),
    [data],
  );

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={formatted}
          margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="seu-rate" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={SEU.red} stopOpacity={0.3} />
              <stop offset="100%" stopColor={SEU.red} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            vertical={false}
            stroke={SEU.gray}
            strokeOpacity={0.12}
            strokeDasharray="2 4"
          />
          <XAxis
            dataKey="date"
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
            width={32}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 8,
              border: "1px solid rgba(49,49,59,0.10)",
              fontSize: 12,
              boxShadow: "0 4px 16px rgba(49,49,59,0.10)",
            }}
            formatter={(v: number) => [`${v}%`, "Rate"]}
            labelStyle={{ color: SEU.navy, fontWeight: 600, fontSize: 11 }}
          />
          <Area
            type="monotone"
            dataKey="rate"
            stroke={SEU.red}
            strokeWidth={2}
            fill="url(#seu-rate)"
            isAnimationActive
            animationDuration={900}
            animationEasing="ease-out"
            activeDot={{ r: 3, fill: SEU.red }}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
