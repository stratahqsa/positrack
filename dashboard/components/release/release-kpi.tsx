import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { fmtDate, fmtHours, fmtMd } from "@/lib/format";
import type { EpicView } from "@/lib/release";

type Tone = "warn" | "good" | "accent";

const TONE_TEXT: Record<Tone, string> = {
  warn: "text-warn",
  good: "text-good",
  accent: "text-accent",
};

/**
 * Top KPI strip for the Release Schedule view (docs/reports-dashboard/plans/
 * 04-release-schedule.md Task 2): Epics / Pending / Done / grand Dev/UI/QA/
 * Spent (hours + man-days) / final release date. `epics` must be the
 * flattened, display-cutoff-applied set the page actually renders
 * (`groups.flatMap(g => g.epics)`), NOT the raw unfiltered views -- so these
 * numbers always match the milestone sections on screen, mirroring
 * weekly/kpi-cards.tsx's "KPI matches the visible rows" convention.
 */
export function ReleaseKpi({
  epics,
  totals,
}: {
  epics: EpicView[];
  totals: { dev: number; ui: number; qa: number; spent: number; finalMs: number | null };
}) {
  const done = epics.filter((e) => e.done).length;
  const pending = epics.length - done;

  const stats: { label: string; value: string; sub?: string; tone?: Tone }[] = [
    { label: "Epics", value: epics.length.toLocaleString() },
    { label: "Pending", value: pending.toLocaleString(), tone: pending > 0 ? "warn" : undefined },
    { label: "Done", value: done.toLocaleString(), tone: done > 0 ? "good" : undefined },
    { label: "Dev", value: fmtHours(totals.dev), sub: fmtMd(totals.dev) },
    { label: "UI", value: fmtHours(totals.ui), sub: fmtMd(totals.ui) },
    { label: "QA", value: fmtHours(totals.qa), sub: fmtMd(totals.qa) },
    { label: "Spent", value: fmtHours(totals.spent), sub: fmtMd(totals.spent) },
    { label: "Final Release", value: fmtDate(totals.finalMs), tone: "accent" },
  ];

  return (
    <Card>
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-border/60 sm:grid-cols-4 lg:grid-cols-8">
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
            <div className="mt-1 text-[10px] font-medium uppercase tracking-wide text-faint">{s.label}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}
