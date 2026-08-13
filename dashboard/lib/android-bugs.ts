import type { DrillBug, StateBreakdownRow } from "@/lib/types";

/**
 * Client-side breakdown of pending (open, not-done) Android bugs by state —
 * same {state,count,bar,pct} shape and math as lib/sup-tickets.ts's
 * breakdownBy(). Callers pass in the already-flattened, already-filtered
 * (not-done) bug list across every story, since a bug's story context isn't
 * the point of this view — it's "what state is the open Android bug backlog
 * in, project-wide".
 */
export function pendingBugStateBreakdown(bugs: DrillBug[]): StateBreakdownRow[] {
  const counts = new Map<string, number>();
  for (const b of bugs) {
    const label = b.state || "—";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  const total = bugs.length || 1;
  const max = Math.max(1, ...counts.values());
  return Array.from(counts, ([state, count]) => ({
    state,
    count,
    bar: Math.round((count / max) * 1000) / 1000,
    pct: Math.round((count / total) * 1000) / 10,
  })).sort((a, b) => b.count - a.count);
}
