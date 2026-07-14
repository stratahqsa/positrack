import type { ComponentType } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "info" | "violet" | "warn" | "danger" | "good" | "neutral";

const TONE: Record<Tone, { ring: string; icon: string; glow: string }> = {
  info: { ring: "ring-info/25", icon: "text-info", glow: "from-info/10" },
  violet: { ring: "ring-violet/25", icon: "text-violet", glow: "from-violet/10" },
  warn: { ring: "ring-warn/25", icon: "text-warn", glow: "from-warn/10" },
  danger: { ring: "ring-danger/30", icon: "text-danger", glow: "from-danger/12" },
  good: { ring: "ring-good/25", icon: "text-good", glow: "from-good/10" },
  neutral: { ring: "ring-border-strong", icon: "text-muted", glow: "from-transparent" },
};

/**
 * Shared chrome for the Health stat-tile row (effort / deadlines / bug
 * pressure): uppercase label + icon, a gradient glow keyed to `tone`, a body
 * slot for the tile's own numbers, and a stub link toward its future report
 * route. Modeled on web/components/kpi-strip.tsx's KpiCard for visual
 * consistency with the rest of the dashboard family.
 */
export function StatTile({
  label,
  icon: Icon,
  tone = "neutral",
  href,
  linkLabel,
  children,
}: {
  label: string;
  icon: ComponentType<{ className?: string }>;
  tone?: Tone;
  href: string;
  linkLabel: string;
  children: React.ReactNode;
}) {
  const t = TONE[tone];
  return (
    <div
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-lg bg-surface/70 p-4 ring-1 backdrop-blur-sm transition-all",
        "hover:-translate-y-px hover:bg-surface",
        t.ring,
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
      <div className="relative mt-2 flex-1">{children}</div>
      <Link
        href={href}
        className="relative mt-3 inline-flex items-center gap-1 self-start text-[11px] font-medium text-faint transition-colors hover:text-accent"
      >
        {linkLabel}
        <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
      </Link>
    </div>
  );
}
