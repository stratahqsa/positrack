"use client";

import * as React from "react";
import {
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RTooltip,
  Legend,
} from "recharts";
import { LineChart as LineIcon, Clock3 } from "lucide-react";
import type { TrendPoint } from "@/lib/types";
import { Card } from "@/components/ui/card";

const SERIES: { key: keyof TrendPoint; label: string; color: string }[] = [
  { key: "total_red", label: "Total RED", color: "var(--color-danger)" },
  { key: "unowned", label: "Unowned", color: "var(--color-warn)" },
  { key: "overshoot", label: "Overshoot", color: "var(--color-violet)" },
  { key: "stale", label: "Stale", color: "var(--color-info)" },
];

function fmtDate(d: string) {
  try {
    return new Date(d).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
    });
  } catch {
    return d;
  }
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border-strong bg-elevated px-3 py-2 text-xs shadow-xl">
      <div className="mb-1 font-semibold text-fg">{fmtDate(label)}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2 tabular">
          <span
            className="size-2 rounded-full"
            style={{ background: p.color }}
          />
          <span className="text-muted">{p.name}</span>
          <span className="ml-auto font-semibold text-fg">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <Card className="border-dashed">
      <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
        <div className="grid size-12 place-items-center rounded-full bg-elevated ring-1 ring-border-strong">
          <Clock3 className="size-6 text-muted" />
        </div>
        <h3 className="text-sm font-semibold text-fg">
          Collecting data — trends appear soon
        </h3>
        <p className="max-w-md text-[12.5px] leading-relaxed text-muted">
          The RED-count trend needs at least two nightly snapshots to draw a
          line. Once the next snapshot lands, this chart will show how unowned,
          overshoot, and stale counts move day over day.
        </p>
      </div>
    </Card>
  );
}

export function TabTrends({ trend }: { trend: TrendPoint[] }) {
  if (trend.length < 2) return <EmptyState />;

  const latest = trend[trend.length - 1];
  const first = trend[0];
  const change = latest.total_red - first.total_red;

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-3">
          <div className="flex items-center gap-2">
            <LineIcon className="size-4 text-accent" />
            <h2 className="text-sm font-semibold text-fg">
              RED accountability over time
            </h2>
          </div>
          <span
            className={
              change > 0
                ? "tabular text-[12px] font-semibold text-danger"
                : change < 0
                  ? "tabular text-[12px] font-semibold text-good"
                  : "tabular text-[12px] text-faint"
            }
          >
            {change > 0 ? `+${change}` : change} since {fmtDate(first.date)}
          </span>
        </div>
        <div className="px-2 py-4">
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart
              data={trend}
              margin={{ top: 8, right: 20, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="redFill" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor="var(--color-danger)"
                    stopOpacity={0.28}
                  />
                  <stop
                    offset="100%"
                    stopColor="var(--color-danger)"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--color-border)"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tickFormatter={fmtDate}
                tick={{ fontSize: 11, fill: "var(--color-muted)" }}
                tickLine={false}
                axisLine={{ stroke: "var(--color-border)" }}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11, fill: "var(--color-muted)" }}
                tickLine={false}
                axisLine={false}
                width={32}
              />
              <RTooltip content={<ChartTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: 11 }}
                iconType="circle"
                iconSize={8}
              />
              <Area
                type="monotone"
                dataKey="total_red"
                name="Total RED"
                stroke="var(--color-danger)"
                strokeWidth={2}
                fill="url(#redFill)"
              />
              {SERIES.slice(1).map((s) => (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label}
                  stroke={s.color}
                  strokeWidth={1.75}
                  dot={false}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
