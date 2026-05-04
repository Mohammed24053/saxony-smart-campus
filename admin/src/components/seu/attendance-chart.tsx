'use client';

import { useMemo } from 'react';
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { SEU } from '@/lib/seu-theme';

export interface AttendanceChartProps {
  /** Sorted [{ date: 'YYYY-MM-DD', rate: 0–100 }, ...]. */
  data: { date: string; rate: number }[];
  height?: number;
}

/**
 * Brand-coloured attendance trend.
 * Recharts re-runs its line-draw animation on each data update, which gives
 * us the spec's "line draws itself" effect for free at mount time.
 */
export function AttendanceChart({ data, height = 280 }: AttendanceChartProps) {
  const formatted = useMemo(
    () => data.map((d) => ({ ...d, date: d.date?.slice(5) ?? '' })),
    [data],
  );

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={formatted} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="seu-rate" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={SEU.red} stopOpacity={0.32} />
              <stop offset="100%" stopColor={SEU.red} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={SEU.gray} strokeOpacity={0.15} strokeDasharray="3 3" />
          <XAxis dataKey="date" tickLine={false} axisLine={false} stroke={SEU.gray} fontSize={11} />
          <YAxis
            domain={[0, 100]}
            tickLine={false}
            axisLine={false}
            stroke={SEU.gray}
            fontSize={11}
            tickFormatter={(v) => `${v}%`}
            width={36}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 10,
              border: '1px solid rgba(49,49,59,0.12)',
              boxShadow: '0 2px 16px rgba(49,49,59,0.08)',
            }}
            formatter={(v: number) => [`${v}%`, 'Rate']}
            labelStyle={{ color: SEU.navy, fontWeight: 600 }}
          />
          <Area
            type="monotone"
            dataKey="rate"
            stroke={SEU.red}
            strokeWidth={2.5}
            fill="url(#seu-rate)"
            isAnimationActive
            animationDuration={1000}
            animationEasing="ease-out"
            activeDot={{ r: 4, fill: SEU.red }}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
