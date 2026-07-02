"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  EMPTY_FILTERS,
  filtersFromParams,
  filtersToQuery,
  type FilterState,
  type RedFilter,
  type SortKey,
  type SortState,
} from "@/lib/filter";

/**
 * Cross-cutting filter state for the whole dashboard. Lives in a client context
 * so the KPI strip, leaderboard, time view, and every Effort section table can
 * read the same filters and any of them can write. Also owns the active tab so
 * "click a KPI / a person" can both set a filter AND jump to the Effort view.
 *
 * State syncs to the URL query string (shareable filtered views) using the
 * History API directly (window.history.replaceState) rather than next/navigation
 * — deliberately. useSearchParams() would force this subtree behind a Suspense
 * boundary that, under `force-dynamic`, leaves the interactive tree un-hydrated;
 * the History API keeps everything a normal client component that hydrates
 * cleanly, while still giving shareable/back-restorable filtered URLs. All
 * snapshot data stays server-side; this only moves tiny filter primitives
 * around the client.
 */

/** Read the current filter state from the browser URL (client-only). */
function readFiltersFromUrl(): FilterState {
  if (typeof window === "undefined") return EMPTY_FILTERS;
  return filtersFromParams(new URLSearchParams(window.location.search));
}

type Toggleable = "owners" | "states" | "priorities";

interface FilterContextValue {
  filters: FilterState;
  /** Currently selected top-level tab (controls <Tabs>). */
  tab: string;
  setTab: (tab: string) => void;

  /** Toggle one value in a multi-select dimension. */
  toggle: (dim: Toggleable, value: string) => void;
  /** Replace a multi-select dimension outright (used by click-to-filter). */
  setDim: (dim: Toggleable, values: string[]) => void;
  toggleRed: (value: RedFilter) => void;
  /** Set the RED set to exactly one value (KPI click-to-filter). */
  setRed: (value: RedFilter) => void;
  setType: (value: string) => void;
  setSearch: (value: string) => void;
  /** Click a sortable header: same key flips dir, new key starts desc. */
  cycleSort: (key: SortKey) => void;
  setSort: (sort: SortState | null) => void;

  /** Drop a single active chip. */
  removeChip: (
    dim: "owner" | "state" | "priority" | "type" | "red" | "search",
    value: string,
  ) => void;
  clearAll: () => void;

  /**
   * Convenience for click-to-filter affordances: apply a partial filter patch
   * and jump to the Effort tab in one call.
   */
  applyAndGoToEffort: (patch: Partial<FilterState>) => void;
}

const FilterContext = React.createContext<FilterContextValue | null>(null);

export function useFilters(): FilterContextValue {
  const ctx = React.useContext(FilterContext);
  if (!ctx) throw new Error("useFilters must be used within <FilterProvider>");
  return ctx;
}

const DIM_KEY: Record<Toggleable, keyof FilterState> = {
  owners: "owners",
  states: "states",
  priorities: "priorities",
};

export function FilterProvider({
  children,
  defaultTab = "effort",
}: {
  children: React.ReactNode;
  defaultTab?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Initialise from the URL once (shareable links). Reading in a lazy
  // initializer keeps this to a single parse on mount.
  const [filters, setFilters] = React.useState<FilterState>(() =>
    filtersFromParams(searchParams),
  );
  const [tab, setTab] = React.useState<string>(defaultTab);

  // Push filter changes to the URL without a navigation/scroll. Kept shallow so
  // typing in Search stays smooth; the server component is force-dynamic and
  // does not re-render from these param changes.
  const isFirst = React.useRef(true);
  React.useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      return; // don't rewrite the URL we just read from
    }
    const qs = filtersToQuery(filters);
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [filters, pathname, router]);

  const toggle = React.useCallback((dim: Toggleable, value: string) => {
    setFilters((prev) => {
      const key = DIM_KEY[dim];
      const cur = prev[key] as string[];
      const next = cur.includes(value)
        ? cur.filter((v) => v !== value)
        : [...cur, value];
      return { ...prev, [key]: next };
    });
  }, []);

  const setDim = React.useCallback((dim: Toggleable, values: string[]) => {
    setFilters((prev) => ({ ...prev, [DIM_KEY[dim]]: values }));
  }, []);

  const toggleRed = React.useCallback((value: RedFilter) => {
    setFilters((prev) => ({
      ...prev,
      reds: prev.reds.includes(value)
        ? prev.reds.filter((v) => v !== value)
        : [...prev.reds, value],
    }));
  }, []);

  const setRed = React.useCallback((value: RedFilter) => {
    setFilters((prev) => ({ ...prev, reds: [value] }));
  }, []);

  const setType = React.useCallback((value: string) => {
    setFilters((prev) => ({ ...prev, type: value }));
  }, []);

  const setSearch = React.useCallback((value: string) => {
    setFilters((prev) => ({ ...prev, search: value }));
  }, []);

  const cycleSort = React.useCallback((key: SortKey) => {
    setFilters((prev) => {
      const cur = prev.sort;
      let next: SortState | null;
      if (!cur || cur.key !== key) {
        next = { key, dir: "desc" };
      } else if (cur.dir === "desc") {
        next = { key, dir: "asc" };
      } else {
        next = null; // third click clears the sort
      }
      return { ...prev, sort: next };
    });
  }, []);

  const setSort = React.useCallback((sort: SortState | null) => {
    setFilters((prev) => ({ ...prev, sort }));
  }, []);

  const removeChip = React.useCallback(
    (
      dim: "owner" | "state" | "priority" | "type" | "red" | "search",
      value: string,
    ) => {
      setFilters((prev) => {
        switch (dim) {
          case "owner":
            return { ...prev, owners: prev.owners.filter((v) => v !== value) };
          case "state":
            return { ...prev, states: prev.states.filter((v) => v !== value) };
          case "priority":
            return {
              ...prev,
              priorities: prev.priorities.filter((v) => v !== value),
            };
          case "type":
            return { ...prev, type: "" };
          case "red":
            return { ...prev, reds: prev.reds.filter((v) => v !== value) };
          case "search":
            return { ...prev, search: "" };
        }
      });
    },
    [],
  );

  const clearAll = React.useCallback(() => {
    // Preserve the active sort (clearing filters shouldn't reshuffle columns).
    setFilters((prev) => ({ ...EMPTY_FILTERS, sort: prev.sort }));
  }, []);

  const applyAndGoToEffort = React.useCallback(
    (patch: Partial<FilterState>) => {
      setFilters((prev) => ({ ...prev, ...patch }));
      setTab("effort");
    },
    [],
  );

  const value = React.useMemo<FilterContextValue>(
    () => ({
      filters,
      tab,
      setTab,
      toggle,
      setDim,
      toggleRed,
      setRed,
      setType,
      setSearch,
      cycleSort,
      setSort,
      removeChip,
      clearAll,
      applyAndGoToEffort,
    }),
    [
      filters,
      tab,
      toggle,
      setDim,
      toggleRed,
      setRed,
      setType,
      setSearch,
      cycleSort,
      setSort,
      removeChip,
      clearAll,
      applyAndGoToEffort,
    ],
  );

  return (
    <FilterContext.Provider value={value}>{children}</FilterContext.Provider>
  );
}
