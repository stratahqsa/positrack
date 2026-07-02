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
}: {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  tone: Tone;
  delta?: number;
  loud?: boolean;
  hint?: string;
}) {
  const t = TONE[tone];
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-lg bg-surface/70 p-3.5 ring-1 backdrop-blur-sm transition-all",
        "hover:-translate-y-px hover:bg-surface",
        t.ring,
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
      {hint ? (
        <div className="relative mt-1.5 text-[10.5px] leading-tight text-faint">
          {hint}
        </div>
      ) : null}
    </div>
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
        />
        <KpiCard
          label="Total RED"
          value={red.total_red}
          icon={Flame}
          tone="danger"
          delta={delta?.total_red}
          hint={delta ? "day-over-day" : "collecting data"}
        />
      </div>
      {!delta ? (
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-faint">
          <FileWarning className="size-3" />
          Day-over-day deltas appear after the next nightly snapshot — collecting
          data.
        </p>
      ) : null}
    </section>
  );
}
