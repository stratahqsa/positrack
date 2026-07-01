import type { PersonScore } from "@/lib/types";

export interface EarnedBadge {
  key: string;
  label: string;
  tone: "good" | "info" | "accent" | "violet" | "warn";
  title: string;
}

/**
 * Derive achievement badges from hygiene signals ONLY (never hours/closures).
 * Thresholds chosen so badges stay meaningful, not participation trophies.
 */
export function earnedBadges(p: PersonScore): EarnedBadge[] {
  const b: EarnedBadge[] = [];
  const s = p.signals;
  if (p.counts.stale === 0 && p.counts.open > 0)
    b.push({
      key: "zero-stale",
      label: "Zero-stale",
      tone: "good",
      title: "No open work has gone stale",
    });
  if (s.estimated >= 0.999 && p.counts.open > 0)
    b.push({
      key: "fully-estimated",
      label: "Fully estimated",
      tone: "info",
      title: "Every open item carries an estimate",
    });
  if (s.moving >= 0.9)
    b.push({
      key: "in-motion",
      label: "In motion",
      tone: "accent",
      title: "Nearly all open work moved recently",
    });
  if (p.logged_recently && s.on_time_logging >= 0.999)
    b.push({
      key: "on-time",
      label: "On-time logging",
      tone: "violet",
      title: "Progress logged on time",
    });
  if (p.score >= 90)
    b.push({
      key: "gold-hygiene",
      label: "Gold hygiene",
      tone: "warn",
      title: "Hygiene score 90+",
    });
  return b;
}
