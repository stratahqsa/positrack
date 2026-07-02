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
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  Clock,
  Hash,
  FileText,
  CalendarDays,
  ChevronDown,
  Check,
} from "lucide-react";
import type { TimeSpent } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useFilters } from "@/components/filter-context";
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

/**
 * Sprint dropdown — only rendered when per-sprint data exists. A clean
 * single-select showing sprints newest→oldest, with the active one clearly
 * labelled on the trigger. Keyboard-navigable via Radix.
 */
function SprintPicker({
  sprints,
  value,
  onChange,
}: {
  sprints: string[];
  value: string;
  onChange: (s: string) => void;
}) {
  // Newest first in the menu (data arrives oldest→newest).
  const ordered = React.useMemo(() => [...sprints].reverse(), [sprints]);
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-wide text-faint">
        Sprint
      </span>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            aria-label={`Sprint: ${value}`}
            className="inline-flex items-center gap-1.5 rounded-md border border-accent/40 bg-accent/12 px-2.5 py-1.5 text-[12px] font-semibold text-accent transition-colors hover:bg-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
          >
            <CalendarDays className="size-3.5" />
            {value}
            <ChevronDown className="size-3.5 opacity-70" />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={6}
            className={cn(
              "z-50 min-w-[10rem] overflow-hidden rounded-lg border border-border-strong bg-elevated p-1 shadow-xl",
              "max-h-[min(20rem,60vh)] overflow-y-auto scroll-slim",
              "animate-in fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-1 data-[side=top]:slide-in-from-bottom-1",
            )}
          >
            <DropdownMenu.RadioGroup value={value} onValueChange={onChange}>
              {ordered.map((s, i) => (
                <DropdownMenu.RadioItem
                  key={s}
                  value={s}
                  className="flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-[12.5px] text-fg/90 outline-none transition-colors data-[highlighted]:bg-surface-2"
                >
                  <span className="grid size-4 place-items-center">
                    {value === s ? (
                      <Check className="size-3.5 text-accent" strokeWidth={3} />
                    ) : null}
                  </span>
                  <span className="flex-1">{s}</span>
                  {i === 0 ? (
                    <span className="text-[10px] font-medium text-faint">
                      latest
                    </span>
                  ) : null}
                </DropdownMenu.RadioItem>
              ))}
            </DropdownMenu.RadioGroup>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
}

export function TabTime({
  timespent,
  sprintsAvailable,
  timespentBySprint,
  defaultSprint,
}: {
  timespent: TimeSpent;
  sprintsAvailable?: string[];
  timespentBySprint?: Record<string, TimeSpent>;
  defaultSprint: string;
}) {
  const { applyAndGoToEffort } = useFilters();

  // The sprint picker is shown only when the snapshot actually carries
  // per-sprint data; otherwise we fall back to the single `timespent`.
  const hasPerSprint =
    !!timespentBySprint &&
    !!sprintsAvailable &&
    sprintsAvailable.length > 0 &&
    Object.keys(timespentBySprint).length > 0;

  const [sprint, setSprint] = React.useState(defaultSprint);

  // Resolve the active dataset defensively: chosen sprint → default sprint →
  // the top-level timespent. Never crashes on a missing key.
  const active: TimeSpent =
    (hasPerSprint &&
      (timespentBySprint![sprint] ?? timespentBySprint![defaultSprint])) ||
    timespent;

  const groups = active.groups;
  const max = groups.reduce((m, g) => Math.max(m, g.minutes), 0) || 1;

  // Top-N chart data (keep it readable); table shows all.
  const chartData = groups.slice(0, 14).map((g) => ({
    key: g.key,
    minutes: g.minutes,
    presentation: g.presentation,
    entries: g.entries,
    issues: g.issues,
  }));

  const jumpToOwner = (person: string) =>
    applyAndGoToEffort({ owners: [person] });

  return (
    <div className="space-y-4">
      <CaveatBanner tone="warn" title="Directional, not a performance scorecard">
        Time is attributed to whoever <strong>logged</strong> each worklog entry.
        Workflow-propagated time is excluded. Reads as effort signal, not output
        or ranking.
      </CaveatBanner>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12px] text-muted">
          {hasPerSprint ? (
            <>
              Showing sprint{" "}
              <span className="font-semibold text-fg">{sprint}</span> ·{" "}
              {active.total} across {active.count} entries
            </>
          ) : (
            <>
              {active.total} across {active.count} entries · all logged time
            </>
          )}
        </p>
        {hasPerSprint ? (
          <SprintPicker
            sprints={sprintsAvailable!}
            value={sprint}
            onChange={setSprint}
          />
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <div className="flex items-center justify-between px-5 pt-4">
            <div>
              <h2 className="text-sm font-semibold text-fg">
                Logged time by person
              </h2>
              <p className="text-[11px] text-muted">
                {active.total} across {active.count} entries
                {hasPerSprint ? ` · ${sprint}` : ""}
              </p>
            </div>
            <Clock className="size-4 text-accent" />
          </div>
          <div className="px-2 pb-3 pt-3">
            {chartData.length === 0 ? (
              <div className="px-4 py-10 text-center text-[12.5px] text-faint">
                No logged time for this sprint.
              </div>
            ) : (
              <ResponsiveContainer
                width="100%"
                height={Math.max(260, chartData.length * 26)}
              >
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
            )}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <div className="border-b border-border/60 px-5 py-3">
            <h2 className="text-sm font-semibold text-fg">Full ledger</h2>
            <p className="mt-0.5 text-[11px] text-faint">
              Click a person to filter Effort by owner.
            </p>
          </div>
          <div className="max-h-[420px] overflow-y-auto scroll-slim">
            {groups.length === 0 ? (
              <div className="px-4 py-10 text-center text-[12.5px] text-faint">
                No entries for this sprint.
              </div>
            ) : (
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
                      onClick={() => jumpToOwner(g.key)}
                      className={cn(
                        "cursor-pointer border-t border-border/50 transition-colors hover:bg-accent/[0.06]",
                        i < 3 && "bg-accent/[0.03]",
                      )}
                      title={`Filter Effort by ${g.key}`}
                    >
                      <td className="py-2 pl-4 pr-2 tabular text-[11px] text-faint">
                        {i + 1}
                      </td>
                      <td className="px-2 py-2">
                        <div className="text-[12.5px] font-medium text-fg/90 hover:text-accent">
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
            )}
          </div>
          <div className="border-t border-border/60 px-4 py-2.5 text-[11px] text-faint">
            Excluded (propagated / out-of-window):{" "}
            <span className="font-medium text-muted">
              {active.excluded.total}
            </span>{" "}
            over {active.excluded.entries} entries.
          </div>
        </Card>
      </div>
    </div>
  );
}
