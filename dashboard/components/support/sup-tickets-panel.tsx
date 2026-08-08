"use client";

import * as React from "react";
import { X } from "lucide-react";
import type { SupTicket } from "@/lib/types";
import { MultiSelect } from "@/components/filters/multi-select";
import { SupTicketTable } from "@/components/support/sup-ticket-table";

function reporterLabel(t: SupTicket): string {
  return t.reporter || "(No reporter)";
}
function assigneeLabel(t: SupTicket): string {
  return t.assignee || "(Unassigned)";
}
function locationLabel(t: SupTicket): string {
  return t.location ?? "(No location)";
}

function sortedOptions(values: Iterable<string>): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

/**
 * "All Pending Tickets" section: reporter/state/location/assignee filters
 * (component reused as-is from the Weekly Deadline filter bar —
 * components/filters/multi-select.tsx — a self-contained popover-checklist,
 * chosen over toggle chips because Reporter can have many distinct values
 * where chips would wrap and clutter) combined with AND logic, feeding the
 * shared SupTicketTable. Local component state, not URL-based like Weekly
 * Deadline's FilterBar -- this is a single page-scoped table, not something
 * that needs a shareable/bookmarkable filtered URL.
 */
export function SupTicketsPanel({ tickets, tz }: { tickets: SupTicket[]; tz: string }) {
  const options = React.useMemo(
    () => ({
      reporter: sortedOptions(tickets.map(reporterLabel)),
      state: sortedOptions(tickets.map((t) => t.state)),
      location: sortedOptions(tickets.map(locationLabel)),
      assignee: sortedOptions(tickets.map(assigneeLabel)),
    }),
    [tickets],
  );

  const [reporter, setReporter] = React.useState<string[]>([]);
  const [state, setState] = React.useState<string[]>([]);
  const [location, setLocation] = React.useState<string[]>([]);
  const [assignee, setAssignee] = React.useState<string[]>([]);

  const filtered = React.useMemo(() => {
    return tickets.filter(
      (t) =>
        (reporter.length === 0 || reporter.includes(reporterLabel(t))) &&
        (state.length === 0 || state.includes(t.state)) &&
        (location.length === 0 || location.includes(locationLabel(t))) &&
        (assignee.length === 0 || assignee.includes(assigneeLabel(t))),
    );
  }, [tickets, reporter, state, location, assignee]);

  const activeCount = reporter.length + state.length + location.length + assignee.length;

  function clearAll() {
    setReporter([]);
    setState([]);
    setLocation([]);
    setAssignee([]);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b border-border/40 px-4 py-2.5">
        <MultiSelect label="Reporter" options={options.reporter} selected={reporter} onChange={setReporter} />
        <MultiSelect label="State" options={options.state} selected={state} onChange={setState} />
        <MultiSelect label="Location" options={options.location} selected={location} onChange={setLocation} />
        <MultiSelect label="Assignee" options={options.assignee} selected={assignee} onChange={setAssignee} />
        {activeCount > 0 ? (
          <button
            type="button"
            onClick={clearAll}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-[12px] font-medium text-faint transition-colors hover:text-fg"
          >
            <X className="size-3.5" />
            Clear filters
          </button>
        ) : null}
        <span className="tabular ml-auto text-[11.5px] text-faint">
          {activeCount > 0 ? `${filtered.length} of ${tickets.length} shown` : `${tickets.length} tickets`}
        </span>
      </div>
      <SupTicketTable rows={filtered} tz={tz} />
    </div>
  );
}
