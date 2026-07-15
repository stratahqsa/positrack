/**
 * Badge-variant classification for the Weekly Deadline story/bug tables.
 * Ports docs/reports-dashboard/reference/specs/PRD_4_Phase1_Weekly_Deadline_
 * View.md §6's state/priority color coding onto this app's existing dark
 * design-token Badge variants (dashboard/components/ui/badge.tsx) rather than
 * the PRD's literal light-theme hex values, which belonged to the old
 * self-contained-HTML report and don't apply to this app's CSS-variable
 * theme system. See the Task 5 completion report for the full mapping
 * rationale (which PRD hue maps to which token, and where two PRD states
 * collapse onto the same variant because the token palette has fewer hues
 * than the PRD's hex list).
 *
 * Match order matters, mirroring the PRD's own note ("RE-OPEN contains
 * 'open', so re-open must be tested before open"): done -> re-open ->
 * testing/qa -> ready -> open -> progress/development -> integration ->
 * blocked -> default.
 */
import type { BadgeProps } from "@/components/ui/badge";

export type BadgeVariant = NonNullable<BadgeProps["variant"]>;

/** State badge tone. `done` (from ScheduleStory.done / the upstream done-state
 *  list) short-circuits straight to the done bucket, ahead of any text match. */
export function stateVariant(state: string | null | undefined, done: boolean): BadgeVariant {
  if (done) return "good";
  const s = (state ?? "").toLowerCase();
  if (s.includes("re-open") || s.includes("reopen")) return "danger";
  if (s.includes("test") || s.includes("qa")) return "info";
  if (s.includes("ready")) return "violet";
  if (s.includes("open")) return "warn";
  if (s.includes("progress") || s.includes("development")) return "warn";
  if (s.includes("integration")) return "accent";
  if (s.includes("blocked")) return "danger";
  return "outline";
}

/** Priority badge tone for bug drill-down rows. Covers both the PRD's
 *  Critical/Blocker/Major/Minor vocabulary and the Urgent/High/Medium/Low
 *  vocabulary actually seen on DrillBug.priority in this instance's data. */
export function priorityVariant(priority: string | null | undefined): BadgeVariant {
  const p = (priority ?? "").toLowerCase();
  if (p.includes("urgent") || p.includes("critical") || p.includes("blocker")) return "danger";
  if (p.includes("high") || p.includes("major")) return "warn";
  if (p.includes("medium")) return "info";
  if (p.includes("low") || p.includes("minor")) return "good";
  return "outline";
}
