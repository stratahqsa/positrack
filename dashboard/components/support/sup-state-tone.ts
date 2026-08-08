import type { BadgeVariant } from "@/components/weekly/badge-tone";
import { categoricalVariant } from "../../lib/categorical-color";

/**
 * PM-confirmed priority tiers for SUP/Type:POS X ticket states (2026-08-08):
 *  - "Escalated": top priority, needs the most attention -> danger (red)
 *  - "New", "On hold": medium priority, needs to be attended to -> warn (amber)
 *  - "X Dev Ticket Created": positive/low priority, already handed off to
 *    dev -> good (green)
 * Any other state (this instance's SUP project has many more beyond what
 * pending POS X tickets currently show — Testing, Waiting On Customer, In
 * Development, etc. — see `describe --project SUP`) falls back to
 * categoricalVariant() so it still reads as visually distinct rather than
 * collapsing to flat gray, without falsely implying a priority tier no one
 * has confirmed.
 */
export function supStateVariant(state: string): BadgeVariant {
  const s = state.trim().toLowerCase();
  if (s === "escalated") return "danger";
  if (s === "new" || s === "on hold") return "warn";
  if (s === "x dev ticket created") return "good";
  return categoricalVariant(state);
}
