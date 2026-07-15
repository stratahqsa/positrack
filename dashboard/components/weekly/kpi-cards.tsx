import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { fmtHours, fmtMd } from "@/lib/format";
import type { ScheduleStory } from "@/lib/types";

type Tone = "warn" | "good" | "danger";

const TONE_TEXT: Record<Tone, string> = {
  warn: "text-warn",
  good: "text-good",
  danger: "text-danger",
};

/**
 * Top KPI strip: Stories / Pending / Done / Bugs / Dev / UI / QA / Total /
 * Spent over whatever story set the caller passes in — the page computes
 * that set as the included+filtered+week-filtered stories so these numbers
 * always equal the sum across the currently-visible week sections (docs/
 * reports-dashboard/plans/03-weekly-deadline-filters.md Task 5 + Task 6's
 * "KPI cards match the visible rows" check). A plain server component: pure
 * render from props, no interactivity.
 */
export function KpiCards({ stories }: { stories: ScheduleStory[] }) {
  const pending = stories.filter((s) => !s.done).length;
  const done = stories.filter((s) => s.done).length;
  // Bugs = sum of open bugs across RE-OPEN stories (Examples_4 §9). story.bugs
  // is already open-only + RE-OPEN-only from the upstream drill-down, so a
  // flat sum over the whole set is equivalent and doesn't need a state check.
  const bugs = stories.reduce((n, s) => n + s.bugs.length, 0);
  const dev = stories.reduce((n, s) => n + s.devEst, 0);
  const ui = stories.reduce((n, s) => n + s.uiEst, 0);
  const qa = stories.reduce((n, s) => n + s.qaEst, 0);
  const spent = stories.reduce((n, s) => n + s.spent, 0);
  const total = dev + ui + qa;

  const stats: { label: string; value: string; sub?: string; tone?: Tone }[] = [
    { label: "Stories", value: stories.length.toLocaleString() },
    { label: "Pending", value: pending.toLocaleString(), tone: pending > 0 ? "warn" : undefined },
    { label: "Done", value: done.toLocaleString(), tone: done > 0 ? "good" : undefined },
    { label: "Bugs", value: bugs.toLocaleString(), tone: bugs > 0 ? "danger" : undefined },
    { label: "Dev", value: fmtHours(dev) },
    { label: "UI", value: fmtHours(ui) },
    { label: "QA", value: fmtHours(qa) },
    { label: "Total", value: fmtHours(total), sub: fmtMd(total) },
    { label: "Spent", value: fmtHours(spent) },
  ];

  return (
    <Card>
      <div className="grid grid-cols-3 gap-px overflow-hidden rounded-lg bg-border/60 sm:grid-cols-5 lg:grid-cols-9">
        {stats.map((s) => (
          <div key={s.label} className="bg-surface/80 px-3 py-3 text-center">
            <div
              className={cn(
                "tabular text-lg font-bold leading-none",
                s.tone ? TONE_TEXT[s.tone] : "text-fg",
              )}
            >
              {s.value}
            </div>
            {s.sub ? <div className="tabular mt-0.5 text-[10px] text-faint">{s.sub}</div> : null}
            <div className="mt-1 text-[10px] font-medium uppercase tracking-wide text-faint">
              {s.label}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
