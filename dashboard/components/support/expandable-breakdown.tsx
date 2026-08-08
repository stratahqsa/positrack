"use client";

import * as React from "react";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { StateBreakdownRow, SupTicket } from "@/lib/types";
import { stateVariant } from "@/components/weekly/badge-tone";
import { SupTicketTable } from "@/components/support/sup-ticket-table";

type Tone = "info" | "good";

const BAR_FILL: Record<Tone, string> = {
  info: "bg-info",
  good: "bg-good",
};

function labelFor(ticket: SupTicket, groupKey: "state" | "location"): string {
  if (groupKey === "state") return ticket.state;
  return ticket.location ?? "(No location)";
}

/**
 * By State / By Location panel for the Support Tickets page: same row
 * layout as bugs/state-breakdown.tsx (badge · count · bar · %), plus a
 * click-to-expand chevron revealing the underlying tickets in a nested
 * SupTicketTable — same interaction as bugs/module-insights.tsx's
 * row-expand. A new component rather than extending StateBreakdown itself,
 * so the already-shipped Medium/Low bug breakdowns on the Bug Analysis page
 * stay untouched (2026-08-08).
 *
 * Ticket grouping is computed client-side from the full `tickets` list via
 * `groupKey` ("state" or "location") — mirrors bug-modules.ts's
 * groupBugsByModule() pattern rather than baking a tickets-per-bucket shape
 * into the Python engine's `by_state`/`by_location` blocks.
 */
export function ExpandableBreakdown({
  rows,
  tickets,
  groupKey,
  tone,
  tz,
}: {
  rows: StateBreakdownRow[];
  tickets: SupTicket[];
  groupKey: "state" | "location";
  tone: Tone;
  tz: string;
}) {
  const [expanded, setExpanded] = React.useState<Set<string>>(() => new Set());

  React.useEffect(() => {
    setExpanded(new Set());
  }, [tickets, groupKey]);

  const ticketsByLabel = React.useMemo(() => {
    const map = new Map<string, SupTicket[]>();
    for (const t of tickets) {
      const label = labelFor(t, groupKey);
      const list = map.get(label);
      if (list) list.push(t);
      else map.set(label, [t]);
    }
    return map;
  }, [tickets, groupKey]);

  function toggle(label: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  return (
    <div>
      {rows.length === 0 ? (
        <div className="px-2 py-4 text-center text-[12px] text-faint">No data.</div>
      ) : (
        <div className="divide-y divide-border/40">
          {rows.map((row) => {
            const isExpanded = expanded.has(row.state);
            const rowTickets = ticketsByLabel.get(row.state) ?? [];
            return (
              <div key={row.state}>
                <div
                  className="flex cursor-pointer items-center gap-2.5 px-1 py-2 hover:bg-elevated/40"
                  onClick={() => toggle(row.state)}
                >
                  <button
                    type="button"
                    aria-expanded={isExpanded}
                    aria-label={`${isExpanded ? "Collapse" : "Expand"} ${row.count} ticket${row.count === 1 ? "" : "s"} for ${row.state}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggle(row.state);
                    }}
                    className="text-faint hover:text-fg"
                  >
                    <ChevronRight className={cn("size-3.5 transition-transform", isExpanded && "rotate-90")} />
                  </button>
                  <Badge
                    variant={stateVariant(row.state, false)}
                    size="sm"
                    className="w-[190px] shrink-0 justify-center truncate"
                  >
                    {row.state || "—"}
                  </Badge>
                  <span className="tabular w-7 shrink-0 text-right text-[11.5px] text-fg/80">{row.count}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-elevated">
                    <div
                      className={cn("h-full rounded-full", BAR_FILL[tone])}
                      style={{ width: `${Math.max(row.bar * 100, 2)}%` }}
                    />
                  </div>
                  <span className="tabular w-11 shrink-0 text-right text-[11px] text-faint">{row.pct}%</span>
                </div>
                {isExpanded ? (
                  <div className="border-t border-border/30 bg-elevated/20 py-2">
                    <SupTicketTable rows={rowTickets} tz={tz} />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
