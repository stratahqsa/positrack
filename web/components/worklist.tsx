"use client";

import * as React from "react";
import { ListChecks, UserX, AlertTriangle, FileWarning } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Epic } from "@/lib/types";
import { epicFlags, overspend, md, overspendLabel } from "@/lib/format";
import { IssueLink } from "@/components/issue-link";
import { Card } from "@/components/ui/card";

type Filter = "all" | "unowned" | "overshoot" | "no-est";

const FILTERS: { key: Filter; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "all", label: "All", icon: ListChecks },
  { key: "unowned", label: "Unowned", icon: UserX },
  { key: "overshoot", label: "Overshoot", icon: AlertTriangle },
  { key: "no-est", label: "No estimate", icon: FileWarning },
];

function reasonChips(epic: Epic) {
  const f = epicFlags(epic);
  const chips: { label: string; className: string }[] = [];
  if (f.overshoot)
    chips.push({
      label: `over by ${overspendLabel(overspend(epic))}`,
      className: "bg-warn/12 text-warn ring-warn/25",
    });
  if (f.unowned)
    chips.push({
      label: "needs owner",
      className: "bg-danger/12 text-danger ring-danger/25",
    });
  if (f.missingEst)
    chips.push({
      label: "needs estimate",
      className: "bg-info/12 text-info ring-info/25",
    });
  return chips;
}

/**
 * Pinned worklist: every RED epic across open sections, sorted by severity
 * (overshoot > unowned > missing estimate, with overspend magnitude tie-break).
 * This is the forcing function — not just row styling.
 */
export function Worklist({ epics }: { epics: Epic[] }) {
  const [filter, setFilter] = React.useState<Filter>("all");

  const flagged = React.useMemo(() => {
    return epics
      .map((e) => ({ e, f: epicFlags(e) }))
      .filter((x) => x.f.red)
      .sort((a, b) => b.f.severity - a.f.severity);
  }, [epics]);

  const counts = React.useMemo(
    () => ({
      all: flagged.length,
      unowned: flagged.filter((x) => x.f.unowned).length,
      overshoot: flagged.filter((x) => x.f.overshoot).length,
      "no-est": flagged.filter((x) => x.f.missingEst).length,
    }),
    [flagged],
  );

  const visible = flagged.filter(({ f }) => {
    if (filter === "all") return true;
    if (filter === "unowned") return f.unowned;
    if (filter === "overshoot") return f.overshoot;
    return f.missingEst;
  });

  return (
    <Card className="overflow-hidden border-danger/20">
      <div className="flex flex-wrap items-center gap-2 border-b border-border/70 bg-gradient-to-r from-danger/[0.06] to-transparent px-4 py-3">
        <ListChecks className="size-4 text-danger" />
        <h2 className="text-[13.5px] font-semibold text-fg">
          Needs owner / estimate / status
        </h2>
        <span className="tabular rounded-md bg-danger/12 px-1.5 py-0.5 text-[11px] font-semibold text-danger ring-1 ring-danger/25">
          {flagged.length}
        </span>
        <span className="hidden text-[11px] text-faint sm:inline">
          sorted by severity — clear these first
        </span>
        <div className="ml-auto flex flex-wrap gap-1">
          {FILTERS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
                filter === key
                  ? "bg-elevated text-fg ring-1 ring-border-strong"
                  : "text-muted hover:text-fg",
              )}
            >
              <Icon className="size-3" />
              {label}
              <span className="tabular text-faint">{counts[key]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="max-h-[380px] overflow-y-auto scroll-slim">
        {visible.length === 0 ? (
          <div className="px-4 py-8 text-center text-[12.5px] text-faint">
            Nothing here — clean board for this filter.
          </div>
        ) : (
          <ul className="divide-y divide-border/50">
            {visible.map(({ e }) => (
              <li
                key={e.id}
                className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-elevated/30"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <IssueLink id={e.id} showIcon={false} />
                    <span className="truncate text-[12.5px] text-fg/90">
                      {e.summary}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {reasonChips(e).map((c, i) => (
                      <span
                        key={i}
                        className={cn(
                          "rounded px-1.5 py-0.5 text-[10px] font-medium ring-1",
                          c.className,
                        )}
                      >
                        {c.label}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="hidden shrink-0 text-right sm:block">
                  <div className="tabular text-[11px] text-faint">
                    est {md(e.total)}
                    <span className="mx-1">·</span>
                    spent {md(e.spent)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
