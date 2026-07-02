"use client";

import * as React from "react";
import {
  Search,
  X,
  SlidersHorizontal,
  UserX,
  AlertTriangle,
  FileWarning,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Epic } from "@/lib/types";
import {
  NEEDS_OWNER,
  activeFilterCount,
  filterChips,
  ownerOptions,
  priorityOptions,
  stateOptions,
  typeOptions,
  type RedFilter,
} from "@/lib/filter";
import { useFilters } from "@/components/filter-context";
import {
  MultiSelectMenu,
  SingleSelectMenu,
  FilterTrigger,
} from "@/components/ui/filter-menu";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check } from "lucide-react";

const RED_ITEMS: {
  value: RedFilter;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { value: "needs-owner", label: "Needs owner", icon: UserX },
  { value: "overshoot", label: "Overshoot", icon: AlertTriangle },
  { value: "unestimated", label: "Unestimated", icon: FileWarning },
];

/** RED multi-toggle in a dropdown (three fixed conditions). */
function RedMenu() {
  const { filters, toggleRed } = useFilters();
  const count = filters.reds.length;
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <FilterTrigger label="RED" count={count} summary={filters.reds.join(", ")} />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={6}
          className={cn(
            "z-50 min-w-[13rem] overflow-hidden rounded-lg border border-border-strong bg-elevated p-1 shadow-xl",
            "animate-in fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-1",
          )}
        >
          {RED_ITEMS.map(({ value, label, icon: Icon }) => {
            const isOn = filters.reds.includes(value);
            return (
              <DropdownMenu.CheckboxItem
                key={value}
                checked={isOn}
                onSelect={(e) => e.preventDefault()}
                onCheckedChange={() => toggleRed(value)}
                className="flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-[12.5px] text-fg/90 outline-none transition-colors data-[highlighted]:bg-surface-2"
              >
                <span
                  className={cn(
                    "grid size-4 shrink-0 place-items-center rounded border transition-colors",
                    isOn ? "border-danger bg-danger text-bg" : "border-border-strong",
                  )}
                >
                  {isOn ? <Check className="size-3" strokeWidth={3} /> : null}
                </span>
                <Icon className="size-3.5 text-danger/80" />
                <span className="flex-1">{label}</span>
              </DropdownMenu.CheckboxItem>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

/** Debounced search box (keeps typing smooth; commits after a short pause). */
function SearchBox() {
  const { filters, setSearch } = useFilters();
  const [local, setLocal] = React.useState(filters.search);

  // Keep the local box in sync when the filter is cleared/changed externally
  // (e.g. Clear all, or a chip removed).
  React.useEffect(() => {
    setLocal(filters.search);
  }, [filters.search]);

  // Debounce commits to the shared state / URL.
  React.useEffect(() => {
    if (local === filters.search) return;
    const id = setTimeout(() => setSearch(local), 180);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local]);

  return (
    <div className="relative flex-1 sm:max-w-xs">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-faint" />
      <input
        type="text"
        role="searchbox"
        aria-label="Search epics and stories"
        placeholder="Search id or summary…"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        className={cn(
          "w-full rounded-md border border-border-strong bg-surface/60 py-1.5 pl-8 pr-7 text-[12.5px] text-fg",
          "placeholder:text-faint focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/40",
        )}
      />
      {local ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            setLocal("");
            setSearch("");
          }}
          className="absolute right-1.5 top-1/2 grid size-5 -translate-y-1/2 place-items-center rounded text-faint transition-colors hover:bg-elevated hover:text-fg"
        >
          <X className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}

/**
 * Persistent, sticky global filter bar. Derives its option lists from the full
 * set of open epics (passed as props from the server component) and cross-filters
 * the Effort view via the shared filter context. Renders active-filter chips, a
 * Clear-all, and a live result count.
 *
 * Priority and Type controls are shown only when the snapshot actually carries
 * those fields — on older snapshots they simply don't appear.
 */
export function FilterBar({
  epics,
  totalEpics,
  visibleEpics,
}: {
  /** All open epics — the universe the filters operate over. */
  epics: Epic[];
  /** Total open-epic count (denominator for the result label). */
  totalEpics: number;
  /** How many epics match the current filters (numerator). */
  visibleEpics: number;
}) {
  const { filters, toggle, setDim, setType, removeChip, clearAll } =
    useFilters();

  const owners = React.useMemo(() => ownerOptions(epics), [epics]);
  const states = React.useMemo(() => stateOptions(epics), [epics]);
  const priorities = React.useMemo(() => priorityOptions(epics), [epics]);
  const types = React.useMemo(() => typeOptions(epics), [epics]);

  const chips = filterChips(filters);
  const active = activeFilterCount(filters);
  const filtered = visibleEpics !== totalEpics || active > 0;

  return (
    <section
      aria-label="Filters"
      className={cn(
        "sticky top-2 z-30 rounded-lg border border-border bg-surface/80 backdrop-blur-md",
        "supports-[backdrop-filter]:bg-surface/70 card-ring",
      )}
    >
      <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
        <span className="hidden items-center gap-1.5 pr-1 text-[11px] font-semibold uppercase tracking-wide text-faint sm:inline-flex">
          <SlidersHorizontal className="size-3.5" />
          Filter
        </span>

        <MultiSelectMenu
          label="Owner"
          options={owners}
          selected={filters.owners}
          onToggle={(v) => toggle("owners", v)}
          onClear={() => setDim("owners", [])}
          summarize={(sel) =>
            sel
              .map((s) => (s === NEEDS_OWNER ? "Needs owner" : s))
              .join(", ")
          }
        />
        <MultiSelectMenu
          label="State"
          options={states}
          selected={filters.states}
          onToggle={(v) => toggle("states", v)}
          onClear={() => setDim("states", [])}
        />
        <MultiSelectMenu
          label="Priority"
          options={priorities}
          selected={filters.priorities}
          onToggle={(v) => toggle("priorities", v)}
          onClear={() => setDim("priorities", [])}
          emptyText="Priority not in this snapshot."
        />
        <SingleSelectMenu
          label="Type"
          options={types}
          value={filters.type}
          onChange={(v) => setType(v === "EPIC" ? "" : v)}
          allOption={{ value: "EPIC", label: "Epic (all)" }}
          emptyText="Child types not in this snapshot."
        />
        <RedMenu />

        <SearchBox />

        <div className="ml-auto flex items-center gap-2">
          <span
            className="tabular whitespace-nowrap text-[11.5px] text-muted"
            aria-live="polite"
          >
            {filtered ? (
              <>
                <span className="font-semibold text-fg">{visibleEpics}</span> of{" "}
                {totalEpics} epics
              </>
            ) : (
              <>
                <span className="font-semibold text-fg">{totalEpics}</span> epics
              </>
            )}
          </span>
          {active > 0 ? (
            <button
              type="button"
              onClick={clearAll}
              className="inline-flex items-center gap-1 rounded-md border border-border-strong bg-surface/60 px-2 py-1 text-[11.5px] font-medium text-muted transition-colors hover:bg-elevated hover:text-fg"
            >
              <X className="size-3" />
              Clear all
            </button>
          ) : null}
        </div>
      </div>

      {chips.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-border/60 px-3 py-2">
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => removeChip(chip.dim, chip.value)}
              className={cn(
                "group inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors",
                chip.dim === "red"
                  ? "border-danger/30 bg-danger/10 text-danger hover:bg-danger/20"
                  : "border-accent/30 bg-accent/10 text-accent hover:bg-accent/20",
              )}
              aria-label={`Remove filter ${chip.label}`}
            >
              <span className="max-w-[16rem] truncate">{chip.label}</span>
              <X className="size-3 opacity-70 transition-opacity group-hover:opacity-100" />
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
