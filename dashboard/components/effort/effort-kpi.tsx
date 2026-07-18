import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { fmtHours, fmtMd } from "@/lib/format";
import type { Effort } from "@/lib/types";

type Tone = "warn" | "good" | "violet" | "danger" | "accent";

const TONE_TEXT: Record<Tone, string> = {
  warn: "text-warn",
  good: "text-good",
  violet: "text-violet",
  danger: "text-danger",
  accent: "text-accent",
};

/**
 * Top KPI strip for the Effort Report (docs/reports-dashboard/plans/
 * 06-effort.md Task 2 / PRD_3 §5 "KPI cards"): Done · Pending · Dev/UI/QA
 * (the S1 pending breakdown) · Pending Total (red) · Mixed · No Stories ·
 * P2/P3 Backlog (purple) · Has P2/P3 Stories (violet, conditional tone) · Grand
 * Total (prominent) — a direct render of `effort.counts`/`effort.totals`,
 * already computed upstream (Plan 1), plus `hasP2Count` from lib/effort.ts
 * (not itself a snapshot field). Dev/UI/QA/Pending Total/Grand Total are
 * minute fields shown via `fmtHours` with an `fmtMd` sub-label, matching
 * release-kpi.tsx's / weekly/kpi-cards.tsx's "hours primary, man-days
 * sub-label" convention for effort figures; plain counts use
 * `.toLocaleString()` with no sub-label, same as those two files' non-effort
 * stats. A plain server component: pure render from props, no interactivity.
 */
export function EffortKpi({ effort, hasP2Count }: { effort: Effort; hasP2Count: number }) {
  const { counts, totals } = effort;
  const pending = totals.pending;
  const grand = totals.grand_total;

  const stats: { label: string; value: string; sub?: string; tone?: Tone; title?: string }[] = [
    {
      label: "Done",
      value: counts.done.toLocaleString(),
      tone: counts.done > 0 ? "good" : undefined,
      title: "Epics resolved since the 29 Jun baseline",
    },
    { label: "Pending", value: counts.pending.toLocaleString(), tone: counts.pending > 0 ? "warn" : undefined },
    { label: "Dev", value: fmtHours(pending.server), sub: fmtMd(pending.server), title: "Pending (S1) Dev estimate" },
    { label: "UI", value: fmtHours(pending.ui), sub: fmtMd(pending.ui), title: "Pending (S1) UI estimate" },
    { label: "QA", value: fmtHours(pending.testing), sub: fmtMd(pending.testing), title: "Pending (S1) QA estimate" },
    { label: "Pending Total", value: fmtHours(pending.total), sub: fmtMd(pending.total), tone: "danger" },
    { label: "Mixed", value: counts.mixed.toLocaleString(), tone: counts.mixed > 0 ? "warn" : undefined, title: "Mixed (P1): some done, some pending" },
    { label: "No Stories", value: counts.no_stories.toLocaleString() },
    { label: "P2/P3 Backlog", value: counts.p2_backlog.toLocaleString(), tone: "violet" },
    {
      label: "Has P2/P3",
      value: hasP2Count.toLocaleString(),
      tone: hasP2Count > 0 ? "violet" : undefined,
      title: "Phase 1 epics containing at least one Phase 2 or Phase 3 story",
    },
    { label: "Grand Total", value: fmtHours(grand.total), sub: fmtMd(grand.total), tone: "accent" },
  ];

  return (
    <Card>
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-border/60 sm:grid-cols-4 lg:grid-cols-6">
        {stats.map((s, i) => {
          const isLast = i === stats.length - 1;
          return (
            <div
              key={s.label}
              title={s.title}
              className={cn("bg-surface/80 px-3 py-3 text-center", isLast && "bg-accent/[0.06]")}
            >
              <div
                className={cn(
                  "tabular font-bold leading-none",
                  isLast ? "text-xl" : "text-lg",
                  s.tone ? TONE_TEXT[s.tone] : "text-fg",
                )}
              >
                {s.value}
              </div>
              {s.sub ? <div className="tabular mt-0.5 text-[10px] text-faint">{s.sub}</div> : null}
              <div className="mt-1 text-[10px] font-medium uppercase tracking-wide text-faint">{s.label}</div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
