import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { BugsBlock } from "@/lib/types";

type Tone = "warn" | "info" | "good" | "danger" | "accent";

const TONE_TEXT: Record<Tone, string> = {
  warn: "text-warn",
  info: "text-info",
  good: "text-good",
  danger: "text-danger",
  accent: "text-accent",
};

/**
 * Top KPI strip (docs/reports-dashboard/plans/05-bug-analysis.md Task 2 /
 * PRD_1 §5): New High/Medium (window), Open High/Medium/Low, Total Open,
 * Modules Hit (7d) — a direct render of `bugs.kpi`, already computed
 * upstream (Plan 1). Tone follows the same High/Medium/Low -> warn/info/good
 * mapping as `priorityVariant` in weekly/badge-tone.ts (reused, not
 * reinvented) for the priority-specific counts; Total Open gets `danger` as
 * the overall bug-pressure signal (mirrors health/bug-pressure-tile.tsx's
 * `openHigh > 0 ? "danger" : ...` convention); Modules Hit is a neutral
 * `accent` highlight, not a severity count. A plain server component: pure
 * render from props, no interactivity — same pattern as weekly/kpi-cards.tsx
 * and release/release-kpi.tsx.
 */
export function BugKpi({ kpi }: { kpi: BugsBlock["kpi"] }) {
  const stats: { label: string; value: number; tone?: Tone }[] = [
    { label: "New High (window)", value: kpi.new_high, tone: kpi.new_high > 0 ? "warn" : undefined },
    { label: "New Medium (window)", value: kpi.new_medium, tone: kpi.new_medium > 0 ? "info" : undefined },
    { label: "Open High", value: kpi.open_high, tone: kpi.open_high > 0 ? "warn" : undefined },
    { label: "Open Medium", value: kpi.open_medium, tone: kpi.open_medium > 0 ? "info" : undefined },
    { label: "Open Low", value: kpi.open_low, tone: kpi.open_low > 0 ? "good" : undefined },
    { label: "Total Open", value: kpi.total_open, tone: kpi.total_open > 0 ? "danger" : undefined },
    { label: "Modules Hit (7d)", value: kpi.modules_hit, tone: "accent" },
  ];

  return (
    <Card>
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-border/60 sm:grid-cols-4 lg:grid-cols-7">
        {stats.map((s) => (
          <div key={s.label} className="bg-surface/80 px-3 py-3 text-center">
            <div
              className={cn("tabular text-lg font-bold leading-none", s.tone ? TONE_TEXT[s.tone] : "text-fg")}
            >
              {s.value.toLocaleString()}
            </div>
            <div className="mt-1 text-[10px] font-medium uppercase tracking-wide text-faint">{s.label}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}
