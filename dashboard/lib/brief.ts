/**
 * Pure read helpers for the AI briefing (`Snapshot.ai_brief`, see lib/types.ts
 * for the full contract). No I/O — the brief itself is generated upstream by
 * scripts/ai_brief.mjs and baked into the snapshot; this module only reads
 * it, same "pure derivation over an already-loaded Snapshot" shape as
 * lib/health.ts (see tests/brief.test.ts).
 */
import { accountability } from "./health";
import type { AiBrief, AiBriefItem, AiBriefSection, Snapshot } from "./types";

/** Reads the AI brief off the snapshot, if present (absent on snapshots that
 *  predate the feature, or when the generation step failed/was skipped this
 *  cycle — fail-soft by design, never a broken partial value). */
export function getBrief(snapshot: Snapshot): AiBrief | null {
  return snapshot.ai_brief ?? null;
}

/**
 * True only when a brief is present AND it was actually generated this
 * cycle. This is the single gate `components/insights/briefing.tsx` (content
 * vs. unavailable state) and `components/insights/brief-teaser.tsx` (shown
 * vs. render nothing) both read, so the Health teaser and the Insights page
 * can never disagree about availability. Note `empty: true` (an all-green
 * "nothing notable" cycle) still counts as ok — empty is a content state,
 * not an availability state.
 */
export function isBriefOk(brief: AiBrief | null): brief is AiBrief & { status: "ok" } {
  return brief != null && brief.status === "ok";
}

/**
 * Age of the brief AT RENDER TIME: wall-clock `nowMs` (the caller's real
 * current time) minus `brief.generated_at`. Deliberately NOT a comparison
 * against `snapshot.meta.generated_at_ms` — both the brief and the meta
 * block are baked into the same snapshot in the same CI run, so that
 * comparison is tautological (always ~0) and useless as a staleness signal
 * (consensus plan M1). Callers should pass an actual `Date.now()` captured
 * at request time, not any snapshot-derived timestamp.
 */
export function briefAgeMs(brief: AiBrief, nowMs: number): number {
  return nowMs - brief.generated_at;
}

/**
 * Formats a briefAgeMs() value as a short relative label, e.g. "42 min ago"
 * (compose as `` `Generated ${formatBriefAge(ageMs)}` `` at the call site).
 * Granularity steps down the way a human judges staleness: minutes below an
 * hour, whole hours below a day, whole days beyond that. A negative age
 * (clock skew — generated_at somehow in the future) clamps to "just now"
 * rather than printing a nonsensical negative count.
 */
export function formatBriefAge(ageMs: number): string {
  const minutes = Math.max(0, Math.round(ageMs / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

const PSEUDONYM_RE = /\bP(\d+)\b/g;

/**
 * Re-hydrates pseudonym tokens ("P1", "P2", …) in a brief back to real
 * names, entirely client-side at render time. PRIVACY: the published
 * snapshot (a public Blob URL, see dashboard/CLAUDE.md) never carries real
 * names for PERSON references — scripts/ai_brief.mjs's distiller hands the
 * model only rank-ordered tokens, and this is the ONLY place those tokens
 * become names again, so a name never touches the wire.
 *
 * `P{i+1}` maps to the i-th entry of `accountability(snapshot,
 * snapshot.meta.generated_at_ms).byPerson` — that ranking (most-overdue
 * first, ties broken by open count then name) is exactly what the upstream
 * pseudonymizer ranked against when it minted the tokens, so P1 is always
 * accountability's rank-0 person. The replace is word-bounded (`\bP(\d+)\b`)
 * so "P1" never matches inside "P10"/"P11" — same guard the (now-removed)
 * server-side rehydrate step used.
 *
 * Applied to `top_finding`, every section item's `text`, and `source.label`
 * (the only three places a pseudonym can appear). Pure and total: a brief
 * with no "P<n>" tokens — an older pre-pseudonym brief, or an all-green
 * `empty` brief — round-trips unchanged. Never mutates its arguments.
 */
export function rehydrateBrief(brief: AiBrief, snapshot: Snapshot): AiBrief {
  const byPerson = accountability(snapshot, snapshot.meta.generated_at_ms).byPerson;
  if (byPerson.length === 0) return brief;

  const sub = (text: string): string =>
    text.replace(PSEUDONYM_RE, (token, n: string) => byPerson[Number(n) - 1]?.name ?? token);

  const subItem = (item: AiBriefItem): AiBriefItem => ({
    ...item,
    text: sub(item.text),
    source: item.source ? { ...item.source, label: sub(item.source.label) } : item.source,
  });

  const subSection = (section: AiBriefSection): AiBriefSection => ({
    ...section,
    items: section.items.map(subItem),
  });

  return {
    ...brief,
    top_finding: sub(brief.top_finding),
    sections: brief.sections.map(subSection),
  };
}
