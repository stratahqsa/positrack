import type { BadgeVariant } from "@/components/weekly/badge-tone";

/** Colorful variants only — excludes "default"/"outline" (both flat gray),
 *  since the whole point is visual differentiation between values. */
const PALETTE: BadgeVariant[] = ["accent", "violet", "warn", "info", "good", "danger"];

/**
 * Deterministic (same string -> same color, every render, every session)
 * categorical color for values with no inherent semantic meaning to a fixed
 * hue — e.g. a SUP ticket's State or Location. Unlike
 * weekly/badge-tone.ts's stateVariant(), which maps known PXB1 workflow
 * keywords ("re-open", "testing", "blocked", ...) to semantic colors and
 * falls back to flat gray "outline" for anything it doesn't recognize —
 * which was EVERY SUP state/location, since none of them match PXB1's
 * vocabulary, so every badge on the Support Tickets page rendered the same
 * gray (2026-08-08). A simple string hash picks a stable slot in a small
 * fixed palette; distinct values only repeat a color once there are more
 * distinct values than PALETTE.length.
 */
export function categoricalVariant(value: string): BadgeVariant {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}
