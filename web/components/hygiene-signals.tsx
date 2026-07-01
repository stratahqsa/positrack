import * as React from "react";
import { cn } from "@/lib/utils";
import type { HygieneSignals } from "@/lib/types";

const ORDER: (keyof HygieneSignals)[] = [
  "stale_free",
  "estimated",
  "moving",
  "on_time_logging",
];

const SHORT: Record<keyof HygieneSignals, string> = {
  stale_free: "Fresh",
  estimated: "Estimated",
  moving: "Moving",
  on_time_logging: "Logging",
};

function tone(v: number): string {
  if (v >= 0.85) return "bg-good";
  if (v >= 0.6) return "bg-accent";
  if (v >= 0.35) return "bg-warn";
  return "bg-danger";
}

/** Four hygiene sub-bars (0..1). Optionally labelled. */
export function HygieneBars({
  signals,
  labels,
  compact = false,
}: {
  signals: HygieneSignals;
  labels?: Record<string, string>;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "grid gap-2",
        compact ? "grid-cols-4" : "grid-cols-2 sm:grid-cols-4",
      )}
    >
      {ORDER.map((k) => {
        const v = Math.max(0, Math.min(1, signals[k] ?? 0));
        return (
          <div key={k} title={labels?.[k]}>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[10px] font-medium uppercase tracking-wide text-faint">
                {SHORT[k]}
              </span>
              <span className="tabular text-[10px] font-semibold text-muted">
                {Math.round(v * 100)}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-elevated">
              <div
                className={cn("h-full rounded-full", tone(v))}
                style={{ width: `${v * 100}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Signal legend chips explaining what each bar means (from signal_labels). */
export function SignalLegend({
  labels,
}: {
  labels: Record<string, string>;
}) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-faint">
      {ORDER.map((k) => (
        <span key={k}>
          <span className="font-medium text-muted">{SHORT[k]}:</span>{" "}
          {labels[k]}
        </span>
      ))}
    </div>
  );
}
