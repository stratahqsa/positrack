"use client";

import * as React from "react";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { IssueLink } from "@/components/ui/issue-link";
import { priorityVariant } from "@/components/weekly/badge-tone";
import type { BlockerBug, BlockerTicket } from "@/lib/types";

type Filter = "all" | "blocked" | "ready";

function KpiTile({ label, value, tone }: { label: string; value: number; tone?: "danger" | "good" }) {
  const toneClass = tone === "danger" ? "text-danger" : tone === "good" ? "text-good" : "text-fg";
  return (
    <div className="rounded-lg bg-surface/70 card-ring px-4 py-3 text-center">
      <div className={`tabular text-2xl font-bold leading-none ${toneClass}`}>{value}</div>
      <div className="mt-1 text-[11px] font-medium uppercase tracking-wide text-faint">{label}</div>
    </div>
  );
}

function FilterTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        active
          ? "rounded-md bg-danger px-3 py-1.5 text-[12.5px] font-semibold text-white"
          : "rounded-md border border-border-strong px-3 py-1.5 text-[12.5px] font-semibold text-muted hover:bg-elevated/60"
      }
    >
      {label}
    </button>
  );
}

function BugRow({ bug, blocking }: { bug: BlockerBug; blocking: boolean }) {
  return (
    <div
      className={
        blocking
          ? "flex items-start justify-between gap-3 rounded-md border border-danger/30 bg-danger/[0.06] px-3 py-2"
          : "flex items-start justify-between gap-3 rounded-md border border-border/50 bg-surface/40 px-3 py-2"
      }
    >
      <div className="min-w-0">
        <IssueLink id={bug.id} showIcon={false} />
        <p className={blocking ? "mt-1 text-[12.5px] text-fg/85" : "mt-1 text-[12.5px] text-muted"}>{bug.summary}</p>
        <p className={blocking ? "mt-0.5 text-[11px] text-muted" : "mt-0.5 text-[11px] text-faint"}>State: {bug.state}</p>
      </div>
      {blocking ? (
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Badge variant={priorityVariant(bug.priority)} size="sm">
            {bug.priority || "—"}
          </Badge>
          <Badge variant="danger" size="sm">
            Blocking
          </Badge>
        </div>
      ) : (
        <Badge variant={priorityVariant(bug.priority)} size="sm">
          {bug.priority || "—"}
        </Badge>
      )}
    </div>
  );
}

function TicketRow({ ticket }: { ticket: BlockerTicket }) {
  const [open, setOpen] = React.useState(false);
  const hasDetail = ticket.blockingBugs.length > 0 || ticket.lowPriorityBugs.length > 0;
  return (
    <div className="overflow-hidden rounded-lg border border-border/60">
      <button
        type="button"
        onClick={() => hasDetail && setOpen((v) => !v)}
        aria-expanded={open}
        disabled={!hasDetail}
        className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors ${hasDetail ? "hover:bg-elevated/40" : "cursor-default"}`}
      >
        <ChevronRight
          className={`mt-0.5 size-4 shrink-0 transition-transform ${hasDetail ? "text-faint" : "text-faint/30"} ${open ? "rotate-90" : ""}`}
        />
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <IssueLink id={ticket.id} showIcon={false} />
            <Badge variant={ticket.status === "blocked" ? "danger" : "good"} size="sm">
              {ticket.status === "blocked" ? "Blocked" : "Ready"}
            </Badge>
          </div>
          <p className="text-[13.5px] font-medium text-fg/90">{ticket.summary}</p>
          <p className="mt-0.5 text-[11px] text-faint">
            State: {ticket.state} · {ticket.blockingBugs.length} blocking bug{ticket.blockingBugs.length === 1 ? "" : "s"} ·{" "}
            {ticket.lowPriorityBugs.length} low priority
          </p>
        </div>
      </button>
      {open && hasDetail ? (
        <div className="space-y-3 border-t border-border/40 bg-elevated/20 px-4 py-3">
          {ticket.blockingBugs.length > 0 ? (
            <div>
              <p className="mb-2 text-[12px] font-semibold text-fg/90">Blocking bugs ({ticket.blockingBugs.length})</p>
              <div className="space-y-2">
                {ticket.blockingBugs.map((b) => (
                  <BugRow key={b.id} bug={b} blocking />
                ))}
              </div>
            </div>
          ) : null}
          {ticket.lowPriorityBugs.length > 0 ? (
            <div>
              <p className="mb-2 text-[12px] font-semibold text-faint">
                Low priority ({ticket.lowPriorityBugs.length}) — not blocking
              </p>
              <div className="space-y-2">
                {ticket.lowPriorityBugs.map((b) => (
                  <BugRow key={b.id} bug={b} blocking={false} />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Bug Blocker Dashboard (2026-07-22): RE-OPEN development tickets and
 * whether they're blocked by unresolved Urgent/High/Medium bugs linked via
 * an OUTWARD "Bugs Reported" link (scripts/reports/bug_blocker.py). Same
 * filter-tabs + KPI-tiles + expandable-row shell as the Module Insights
 * panel (components/bugs/module-insights-panel.tsx), adapted for tickets
 * instead of modules. Low-priority linked bugs are shown de-emphasized
 * rather than hidden — they don't block, but the ticket isn't fully
 * bug-free either.
 */
export function BlockerPanel({ tickets, kpi }: { tickets: BlockerTicket[]; kpi: { total: number; blocked: number; ready: number } }) {
  const [filter, setFilter] = React.useState<Filter>("all");
  const rows = tickets.filter((t) => filter === "all" || t.status === filter);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <FilterTab label={`All (${kpi.total})`} active={filter === "all"} onClick={() => setFilter("all")} />
        <FilterTab label={`Blocked (${kpi.blocked})`} active={filter === "blocked"} onClick={() => setFilter("blocked")} />
        <FilterTab label={`Ready to close (${kpi.ready})`} active={filter === "ready"} onClick={() => setFilter("ready")} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiTile label="Total RE-OPEN dev tickets" value={kpi.total} />
        <KpiTile label="Blocked by bugs" value={kpi.blocked} tone="danger" />
        <KpiTile label="Ready to close" value={kpi.ready} tone="good" />
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface/30 px-4 py-10 text-center text-[12.5px] text-faint">
          No tickets match this filter.
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((t) => (
            <TicketRow key={t.id} ticket={t} />
          ))}
        </div>
      )}
    </div>
  );
}
