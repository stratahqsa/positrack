"use client";

import * as React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Cell,
  Tooltip as RTooltip,
} from "recharts";
import { Clock, Hash, FileText } from "lucide-react";
import type { TimeSpent } from "@/lib/types";
import { hm } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { CaveatBanner } from "@/components/caveat-banner";

const BAR = "var(--color-accent)";

function ChartTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-md border border-border-strong bg-elevated px-2.5 py-1.5 text-xs shadow-xl">
      <div className="font-semibold text-fg">{p.key}</div>
      <div className="tabular text-muted">{p.presentation}</div>
      <div className="tabular text-faint">
        {p.entries} entries · {p.issues} issues
      </div>
    </div>
  );
}

export function TabTime({ timespent }: { timespent: TimeSpent }) {
  const groups = timespent.groups;
  const max = groups.reduce((m, g) => Math.max(m, g.minutes), 0) || 1;

  // Top-N chart data (keep it readable); table shows all.
  const chartData = groups.slice(0, 14).map((g) => ({
    key: g.key,
    minutes: g.minutes,
    presentation: g.presentation,
    entries: g.entries,
    issues: g.issues,
  }));

  return (
    <div className="space-y-4">
      <CaveatBanner tone="warn" title="Directional, not a performance scorecard">
        Time is attributed to whoever <strong>logged</strong> each worklog entry.
        Workflow-propagated time is excluded. Reads as effort signal, not output
        or ranking.
      </CaveatBanner>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <div className="flex items-center justify-between px-5 pt-4">
            <div>
              <h2 className="text-sm font-semibold text-fg">
                Logged time by person
              </h2>
              <p className="text-[11px] text-muted">
                {timespent.total} across {timespent.count} entries
              </p>
            </div>
            <Clock className="size-4 text-accent" />
          </div>
          <div className="px-2 pb-3 pt-3">
            <ResponsiveContainer width="100%" height={Math.max(260, chartData.length * 26)}>
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 0, right: 16, left: 8, bottom: 0 }}
                barCategoryGap={6}
              >
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="key"
                  width={104}
                  tick={{ fontSize: 11, fill: "var(--color-muted)" }}
                  tickLine={false}
                  axisLine={false}
                />
                <RTooltip
                  cursor={{ fill: "var(--color-elevated)", opacity: 0.4 }}
                  content={<ChartTooltip />}
                />
                <Bar dataKey="minutes" radius={[0, 4, 4, 0]} maxBarSize={16}>
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={BAR} fillOpacity={1 - i * 0.045} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <div className="border-b border-border/60 px-5 py-3">
            <h2 className="text-sm font-semibold text-fg">Full ledger</h2>
          </div>
          <div className="max-h-[420px] overflow-y-auto scroll-slim">
            <table className="w-full border-collapse">
              <thead className="sticky top-0 bg-surface-2/95 backdrop-blur">
                <tr className="text-[10px] uppercase tracking-wide text-faint">
                  <th className="py-2 pl-4 pr-2 text-left font-semibold">#</th>
                  <th className="px-2 py-2 text-left font-semibold">Person</th>
                  <th className="px-2 py-2 text-right font-semibold">
                    <Hash className="ml-auto size-3" />
                  </th>
                  <th className="px-2 py-2 text-right font-semibold">
                    <FileText className="ml-auto size-3" />
                  </th>
                  <th className="px-4 py-2 text-right font-semibold">Time</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g, i) => (
                  <tr
                    key={g.key}
                    className={cn(
                      "border-t border-border/50 transition-colors hover:bg-elevated/40",
                      i < 3 && "bg-accent/[0.03]",
                    )}
                  >
                    <td className="py-2 pl-4 pr-2 tabular text-[11px] text-faint">
                      {i + 1}
                    </td>
                    <td className="px-2 py-2">
                      <div className="text-[12.5px] font-medium text-fg/90">
                        {g.key}
                      </div>
                      <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-elevated">
                        <div
                          className="h-full rounded-full bg-accent/80"
                          style={{ width: `${(g.minutes / max) * 100}%` }}
                        />
                      </div>
                    </td>
                    <td className="px-2 py-2 text-right tabular text-[11.5px] text-muted">
                      {g.entries}
                    </td>
                    <td className="px-2 py-2 text-right tabular text-[11.5px] text-muted">
                      {g.issues}
                    </td>
                    <td className="px-4 py-2 text-right tabular text-[12px] font-semibold text-fg">
                      {g.presentation}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-border/60 px-4 py-2.5 text-[11px] text-faint">
            Excluded (propagated / out-of-window):{" "}
            <span className="font-medium text-muted">
              {timespent.excluded.total}
            </span>{" "}
            over {timespent.excluded.entries} entries.
          </div>
        </Card>
      </div>
    </div>
  );
}
