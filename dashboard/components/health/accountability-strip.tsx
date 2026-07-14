import type { ComponentType } from "react";
import Link from "next/link";
import { UserX, CircleAlert, RotateCcw, ArrowRight } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Tone = "danger" | "warn" | "info";

const TONE: Record<Tone, string> = {
  danger: "text-danger",
  warn: "text-warn",
  info: "text-info",
};

function MiniStat({
  label,
  value,
  hint,
  tone,
  icon: Icon,
}: {
  label: string;
  value: number;
  hint: string;
  tone: Tone;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <div
        className={cn(
          "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-elevated ring-1 ring-border-strong",
          TONE[tone],
        )}
      >
        <Icon className="size-4" />
      </div>
      <div>
        <div className="tabular text-xl font-bold leading-none text-fg">{value}</div>
        <div className="mt-1 text-[11.5px] font-medium text-muted">{label}</div>
        <div className="text-[10.5px] text-faint">{hint}</div>
      </div>
    </div>
  );
}

/**
 * Accountability strip. "Needs an owner" uses insights.red_counts.unowned —
 * unowned OPEN EPICS, the real signal — NOT accountability().unowned, which
 * is story-level and ~0 in current data. Overdue/reopened/byPerson come from
 * accountability(snap, now).
 */
export function AccountabilityStrip({
  unownedEpics,
  overdue,
  reopened,
  byPerson,
}: {
  unownedEpics: number;
  overdue: number;
  reopened: number;
  byPerson: { name: string; overdue: number; open: number }[];
}) {
  const topOverdue = byPerson.filter((p) => p.overdue > 0).slice(0, 5);
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-1.5">
          <UserX className="size-4 text-danger" />
          Accountability
        </CardTitle>
        <Link
          href="#"
          className="group inline-flex items-center gap-1 text-[11px] font-medium text-faint transition-colors hover:text-accent"
        >
          View details
          <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-3 sm:max-w-lg sm:gap-4">
          <MiniStat
            label="Needs an owner"
            value={unownedEpics}
            hint="open epics"
            tone="danger"
            icon={UserX}
          />
          <MiniStat
            label="Overdue"
            value={overdue}
            hint="past QA deadline"
            tone="warn"
            icon={CircleAlert}
          />
          <MiniStat label="Re-opened" value={reopened} hint="stories" tone="info" icon={RotateCcw} />
        </div>
        {topOverdue.length > 0 ? (
          <div className="mt-4 border-t border-border/60 pt-3">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-faint">
              Top by overdue
            </p>
            <ul className="flex flex-wrap gap-2">
              {topOverdue.map((p) => (
                <li key={p.name}>
                  <Badge variant="warn">
                    {p.name} · {p.overdue} overdue
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
