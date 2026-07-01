import * as React from "react";
import { cn } from "@/lib/utils";

type Tone = "accent" | "good" | "warn" | "danger" | "info" | "violet";

const TONE_BG: Record<Tone, string> = {
  accent: "bg-accent",
  good: "bg-good",
  warn: "bg-warn",
  danger: "bg-danger",
  info: "bg-info",
  violet: "bg-violet",
};

/**
 * Deterministic, SSR-friendly progress bar (no client JS). `value` is 0..100;
 * values above 100 clamp visually but an `over` marker can be shown by callers.
 */
export function Progress({
  value,
  tone = "accent",
  className,
  trackClassName,
}: {
  value: number;
  tone?: Tone;
  className?: string;
  trackClassName?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      className={cn(
        "h-1.5 w-full overflow-hidden rounded-full bg-elevated",
        trackClassName,
      )}
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn("h-full rounded-full transition-all", TONE_BG[tone], className)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/** Multi-segment stacked bar (e.g. Dev/UI/QA composition). */
export function StackedBar({
  segments,
  className,
}: {
  segments: { value: number; tone: Tone; label?: string }[];
  className?: string;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  return (
    <div
      className={cn(
        "flex h-1.5 w-full overflow-hidden rounded-full bg-elevated",
        className,
      )}
    >
      {segments.map((s, i) => (
        <div
          key={i}
          className={TONE_BG[s.tone]}
          style={{ width: `${(s.value / total) * 100}%` }}
          title={s.label}
        />
      ))}
    </div>
  );
}
