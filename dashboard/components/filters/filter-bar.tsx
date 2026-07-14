"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  AlertTriangle,
  Clock,
  Filter as FilterIcon,
  RotateCcw,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  EMPTY_FILTERS,
  activeFilterCount,
  toQueryString,
  type Filters,
} from "@/lib/filters";
import { useFilters } from "@/components/filters/filter-context";
import { MultiSelect } from "@/components/filters/multi-select";
import { Card } from "@/components/ui/card";

type MultiDim = "assignee" | "sprint" | "state" | "epic";
type ToggleDim = "pendingOnly" | "overdueOnly" | "reopenedOnly";

function ToggleChip({
  label,
  active,
  onClick,
  icon: Icon,
  tone,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  tone: "accent" | "warn" | "danger";
}) {
  const toneClass = {
    accent: "border-accent/40 bg-accent/12 text-accent",
    warn: "border-warn/40 bg-warn/12 text-warn",
    danger: "border-danger/40 bg-danger/12 text-danger",
  }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[12px] font-medium transition-colors",
        active
          ? toneClass
          : "border-border bg-surface/60 text-muted hover:border-border-strong hover:text-fg",
      )}
    >
      <Icon className="size-3.5" />
      {label}
    </button>
  );
}

/**
 * Global URL-based filter bar (docs/reports-dashboard/plans/
 * 03-weekly-deadline-filters.md Task 4). Reads the current `Filters` from the
 * URL via `useFilters()`; every control writes a NEW full query string with
 * `router.replace(pathname + "?" + toQueryString(next), { scroll: false })`
 * so filtering is a fast client-side navigation (no full reload) and the
 * resulting URL is always shareable/bookmarkable. This component owns no
 * filter state itself — the URL is the single source of truth, and the
 * server page re-derives `filtered`/`groups` from it on every navigation.
 */
export function FilterBar({
  options,
  epicNames,
  weekCount,
}: {
  options: { assignee: string[]; sprint: string[]; state: string[]; epic: string[] };
  epicNames: Record<string, string>;
  weekCount: number;
}) {
  const filters = useFilters();
  const router = useRouter();
  const pathname = usePathname();

  function push(next: Filters) {
    const qs = toQueryString(next);
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function setDim(key: MultiDim, values: string[]) {
    push({ ...filters, [key]: values });
  }
  function setWeeks(values: string[]) {
    push({ ...filters, week: values.map(Number) });
  }
  function toggle(key: ToggleDim) {
    push({ ...filters, [key]: !filters[key] });
  }
  function clearAll() {
    push(EMPTY_FILTERS);
  }

  const weekOptions = React.useMemo(
    () => Array.from({ length: weekCount }, (_, i) => String(i + 1)),
    [weekCount],
  );
  const count = activeFilterCount(filters);

  return (
    <Card className="p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 hidden shrink-0 items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-faint sm:inline-flex">
          <FilterIcon className="size-3.5" />
          Filter
        </span>

        <MultiSelect
          label="Assignee"
          options={options.assignee}
          selected={filters.assignee}
          onChange={(v) => setDim("assignee", v)}
        />
        <MultiSelect
          label="Sprint"
          options={options.sprint}
          selected={filters.sprint}
          onChange={(v) => setDim("sprint", v)}
        />
        <MultiSelect
          label="State"
          options={options.state}
          selected={filters.state}
          onChange={(v) => setDim("state", v)}
        />
        <MultiSelect
          label="Epic"
          options={options.epic}
          selected={filters.epic}
          onChange={(v) => setDim("epic", v)}
          optionLabel={(id) => epicNames[id] ?? id}
        />
        <MultiSelect
          label="Week"
          options={weekOptions}
          selected={filters.week.map(String)}
          onChange={setWeeks}
          optionLabel={(v) => `Week ${v}`}
        />

        <span className="mx-1 hidden h-5 w-px shrink-0 bg-border sm:block" />

        <ToggleChip
          label="Pending"
          active={filters.pendingOnly}
          onClick={() => toggle("pendingOnly")}
          icon={Clock}
          tone="accent"
        />
        <ToggleChip
          label="Overdue"
          active={filters.overdueOnly}
          onClick={() => toggle("overdueOnly")}
          icon={AlertTriangle}
          tone="warn"
        />
        <ToggleChip
          label="Re-opened"
          active={filters.reopenedOnly}
          onClick={() => toggle("reopenedOnly")}
          icon={RotateCcw}
          tone="danger"
        />

        {count > 0 ? (
          <button
            type="button"
            onClick={clearAll}
            className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-md px-2.5 py-1.5 text-[12px] font-medium text-faint transition-colors hover:text-danger"
          >
            <X className="size-3.5" />
            Clear all
            <span className="tabular text-[10.5px]">({count})</span>
          </button>
        ) : null}
      </div>
    </Card>
  );
}
