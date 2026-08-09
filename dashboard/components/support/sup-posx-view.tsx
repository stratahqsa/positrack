"use client";

import * as React from "react";
import { X } from "lucide-react";
import type { SupTicket } from "@/lib/types";
import {
  EMPTY_SUP_FILTERS,
  activeFilterCount,
  breakdownBy,
  computeSupKpi,
  filterSupTickets,
  supTicketOptions,
  type SupFilters,
} from "@/lib/sup-tickets";
import { MultiSelect } from "@/components/filters/multi-select";
import { Card } from "@/components/ui/card";
import { Section } from "@/components/bugs/section";
import { SupPosxKpi } from "@/components/support/sup-posx-kpi";
import { ExpandableBreakdown } from "@/components/support/expandable-breakdown";
import { SupTicketTable } from "@/components/support/sup-ticket-table";

/**
 * Support Tickets page body: ONE shared filter (Reporter/State/Location/
 * Assignee, AND-combined) driving everything below it — the KPI strip, both
 * bar charts, and the full listing all recompute from the same filtered
 * ticket subset (PM-confirmed, 2026-08-08; previously the filter only
 * narrowed the ticket table, leaving the count badges and bar charts
 * showing the unfiltered totals — the same split-brain problem
 * components/filters/filter-bar.tsx already avoids elsewhere on this
 * dashboard by being one page-wide filter, not one per section).
 */
export function SupPosxView({ tickets, tz }: { tickets: SupTicket[]; tz: string }) {
  const [filters, setFilters] = React.useState<SupFilters>(EMPTY_SUP_FILTERS);

  const options = React.useMemo(() => supTicketOptions(tickets), [tickets]);
  const filtered = React.useMemo(() => filterSupTickets(tickets, filters), [tickets, filters]);
  const kpi = React.useMemo(() => computeSupKpi(filtered), [filtered]);
  const byState = React.useMemo(() => breakdownBy(filtered, "state"), [filtered]);
  const byLocation = React.useMemo(() => breakdownBy(filtered, "location"), [filtered]);

  const activeCount = activeFilterCount(filters);

  function setDim(key: keyof SupFilters, values: string[]) {
    setFilters((prev) => ({ ...prev, [key]: values }));
  }
  function clearAll() {
    setFilters(EMPTY_SUP_FILTERS);
  }

  return (
    <div className="space-y-5">
      <SupPosxKpi kpi={kpi} />

      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <MultiSelect
            label="Reporter"
            options={options.reporter}
            selected={filters.reporter}
            onChange={(v) => setDim("reporter", v)}
          />
          <MultiSelect
            label="State"
            options={options.state}
            selected={filters.state}
            onChange={(v) => setDim("state", v)}
          />
          <MultiSelect
            label="Location"
            options={options.location}
            selected={filters.location}
            onChange={(v) => setDim("location", v)}
          />
          <MultiSelect
            label="Assignee"
            options={options.assignee}
            selected={filters.assignee}
            onChange={(v) => setDim("assignee", v)}
          />
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
            {activeCount > 0 ? `${filtered.length} of ${tickets.length} tickets` : `${tickets.length} tickets`}
          </span>
        </div>
      </Card>

      <Section title="By State" tone="violet" count={filtered.length}>
        <div className="p-4">
          <ExpandableBreakdown rows={byState} tickets={filtered} groupKey="state" tone="info" tz={tz} />
        </div>
      </Section>

      <Section title="By Location" tone="violet" count={filtered.length}>
        <div className="p-4">
          <ExpandableBreakdown rows={byLocation} tickets={filtered} groupKey="location" tone="good" tz={tz} />
        </div>
      </Section>

      <Section title="All Pending Tickets" tone="violet" count={filtered.length}>
        <div className="p-4">
          <SupTicketTable rows={filtered} tz={tz} />
        </div>
      </Section>
    </div>
  );
}
