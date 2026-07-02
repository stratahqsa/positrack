"use client";

import * as React from "react";
import {
  AlertTriangle,
  UserX,
  Timer,
  Ban,
  FileWarning,
  Flame,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { RedCounts, RedDelta } from "@/lib/types";
import { EMPTY_FILTERS, type RedFilter } from "@/lib/filter";
import { useFilters } from "@/components/filter-context";

type Tone = "danger" | "warn" | "info" | "violet" | "neutral";

const TONE: Record<
  Tone,
  { ring: string; icon: string; glow: string; value: string }
> = {
  danger: {
    ring: "ring-danger/30",
    icon: "text-danger",
    glow: "from-danger/12",
    value: "text-danger",
  },
  warn: {
    ring: "ring-warn/25",
    icon: "text-warn",
    glow: "from-warn/10",
    value: "text-warn",
  },
  info: {
    ring: "ring-info/25",
    icon: "text-info",
    glow: "from-info/10",
    value: "text-fg",
  },
  violet: {
    ring: "ring-violet/25",
    icon: "text-violet",
    glow: "from-violet/10",
    value: "text-fg",
  },
  neutral: {
    ring: "ring-border-strong",
    icon: "text-muted",
    glow: "from-transparent",
    value: "text-fg",
  },
};

/** Day-over-day delta chip. Down is good for RED counts (green ▼). */
function DeltaChip({ delta }: { delta: number | undefined }) {
  if (delta === undefined || delta === null) return null;
  if (delta === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-faint">
        <Minus className="size-3" /> 0
      </span>
    );
  }
  const worse = delta > 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-[11px] font-semibold",
        worse ? "text-danger" : "text-good",
      )}
      title={`${worse ? "+" : ""}${delta} vs previous snapshot`}
    >
      {worse ? (
        <TrendingUp className="size-3" />
      ) : (
        <TrendingDown className="size-3" />
      )}
      {worse ? `+${delta}` : delta}
    </span>
  );
}

function KpiCard({
  label,
  value,
  icon: Icon,
  tone,
  delta,
  loud,
  hint,
  onClick,
  actionHint,
  active,
}: {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  tone: Tone;
  delta?: number;
  loud?: boolean;
  hint?: string;
  /** When set, the card becomes a button that filters the Effort view. */
  onClick?: () => void;
  /** Extra affordance text shown on hover (e.g. "Filter Effort →"). */
  actionHint?: string;
  /** Whether this card's filter is currently applied. */
  active?: boolean;
}) {
  const t = TONE[tone];
  const interactive = !!onClick;
  const Comp = interactive ? "button" : "div";
  return (
    <Comp
      type={interactive ? "button" : undefined}
      onClick={onClick}
      aria-pressed={interactive ? !!active : undefined}
      className={cn(
        "group relative overflow-hidden rounded-lg bg-surface/70 p-3.5 text-left ring-1 backdrop-blur-sm transition-all",
        "hover:-translate-y-px hover:bg-surface",
        interactive &&
          "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60",
        t.ring,
        active && "ring-2",
        loud && "pulse-danger",
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-0 bg-gradient-to-br to-transparent opacity-70",
          t.glow,
        )}
      />
      <div className="relative flex items-start justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted">
          {label}
        </span>
        <Icon className={cn("size-4 shrink-0", t.icon)} />
      </div>
      <div className="relative mt-2 flex items-end justify-between gap-2">
        <span
          className={cn(
            "tabular text-2xl font-bold leading-none",
            t.value,
            loud && "text-danger",
          )}
        >
          {value}
        </span>
        <DeltaChip delta={delta} />
      </div>
      {/* Hint line: swaps to the action affordance on hover for clickable cards. */}
      {hint || actionHint ? (
        <div className="relative mt-1.5 h-3.5 text-[10.5px] leading-tight">
          {hint ? (
            <span
              className={cn(
                "block text-faint transition-opacity",
                interactive && "group-hover:opacity-0",
                active && "opacity-0",
              )}
            >
              {hint}
            </span>
          ) : null}
          {interactive && actionHint ? (
            <span
              className={cn(
                "absolute inset-0 flex items-center font-medium text-accent transition-opacity",
                active ? "opacity-100" : "opacity-0 group-hover:opacity-100",
              )}
            >
              {active ? "Filtering Effort · click to clear" : actionHint}
            </span>
          ) : null}
        </div>
      ) : null}
    </Comp>
  );
}

export function KpiStrip({
  red,
  delta,
  openEpics,
  pendingMinutes,
  pendingMd,
}: {
  red: RedCounts;
  delta: RedDelta | null;
  openEpics: number;
  pendingMinutes: number;
  pendingMd: string;
}) {
  const { filters, applyAndGoToEffort } = useFilters();

  // A card is "active" when the Effort view is currently filtered to exactly
  // its RED condition. Clicking an active card clears it.
  const isExactRed = React.useCallback(
    (r: RedFilter) => filters.reds.length === 1 && filters.reds[0] === r,
    [filters.reds],
  );
  const toggleRedFilter = React.useCallback(
    (r: RedFilter) => {
      if (isExactRed(r)) {
        applyAndGoToEffort({ reds: [] });
      } else {
        applyAndGoToEffort({ reds: [r] });
      }
    },
    [isExactRed, applyAndGoToEffort],
  );

  // "Total RED" surfaces every RED epic = the union of the three conditions.
  const allReds: RedFilter[] = ["needs-owner", "overshoot", "unestimated"];
  const isAllRed =
    filters.reds.length === allReds.length &&
    allReds.every((r) => filters.reds.includes(r));

  return (
    <section aria-label="Key metrics">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard
          label="Open epics"
          value={openEpics}
          icon={TrendingUp}
          tone="info"
          hint="unresolved in scope"
        />
        <KpiCard
          label="Pending"
          value={pendingMd}
          icon={Timer}
          tone="violet"
          hint={`${Math.round(pendingMinutes / 60).toLocaleString()}h estimated`}
        />
        <KpiCard
          label="Overshoot"
          value={red.overshoot}
          icon={AlertTriangle}
          tone="warn"
          delta={delta?.overshoot}
          hint="spent > estimate"
          actionHint="Filter Effort →"
          onClick={() => toggleRedFilter("overshoot")}
          active={isExactRed("overshoot")}
        />
        <KpiCard
          label={`Stale >${red.stale_days}d`}
          value={red.stale}
          icon={Ban}
          tone="warn"
          delta={delta?.stale}
          hint="untouched recently"
        />
        <KpiCard
          label="Needs owner"
          value={red.unowned}
          icon={UserX}
          tone="danger"
          delta={delta?.unowned}
          loud={red.unowned > 0}
          hint={
            red.role_owned && red.role_owned > 0
              ? `blank or role-parked · ${red.role_owned} on a role account`
              : "blank or role-parked — act first"
          }
          actionHint="Filter Effort →"
          onClick={() => toggleRedFilter("needs-owner")}
          active={isExactRed("needs-owner")}
        />
        <KpiCard
          label="Total RED"
          value={red.total_red}
          icon={Flame}
          tone="danger"
          delta={delta?.total_red}
          hint={delta ? "day-over-day" : "collecting data"}
          actionHint="Show all RED →"
          onClick={() =>
            applyAndGoToEffort({ reds: isAllRed ? [] : [...allReds] })
          }
          active={isAllRed}
        />
      </div>
      {/* Unestimated is a per-epic RED condition too; expose it as a small link
          so leads can jump straight to those epics. */}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        {red.unestimated > 0 ? (
          <button
            type="button"
            onClick={() => toggleRedFilter("unestimated")}
            className={cn(
              "inline-flex items-center gap-1 text-[11px] font-medium transition-colors",
              isExactRed("unestimated")
                ? "text-info"
                : "text-faint hover:text-info",
            )}
          >
            <FileWarning className="size-3" />
            {red.unestimated} unestimated{" "}
            {isExactRed("unestimated") ? "· filtering" : "→ filter Effort"}
          </button>
        ) : null}
        {filters.reds.length > 0 ? (
          <button
            type="button"
            onClick={() => applyAndGoToEffort({ ...EMPTY_FILTERS })}
            className="text-[11px] font-medium text-faint underline-offset-2 hover:text-fg hover:underline"
          >
            clear filter
          </button>
        ) : null}
        {!delta ? (
          <span className="inline-flex items-center gap-1.5 text-[11px] text-faint">
            <FileWarning className="size-3" />
            Day-over-day deltas appear after the next nightly snapshot.
          </span>
        ) : null}
      </div>
    </section>
  );
}
