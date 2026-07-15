"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { parseFilters, type Filters } from "@/lib/filters";

/**
 * Small client hook: the current `Filters` derived from the URL search
 * params. Wraps next/navigation's `useSearchParams()` + `lib/filters`'
 * `parseFilters` so every filter-aware client component (FilterBar today;
 * future report views' client islands later, per docs/reports-dashboard/
 * plans/03-weekly-deadline-filters.md's "Next" section) reads the same
 * URL-derived state the same way, without duplicating the parse call.
 *
 * Filter state itself is NOT owned here — it lives in the URL (server-
 * readable, shareable). This hook is read-only; writes go through
 * `useRouter().replace()` directly in the component that owns the change
 * (see FilterBar), which is what keeps the URL as the single source of
 * truth instead of a second, potentially-stale client copy.
 */
export function useFilters(): Filters {
  const searchParams = useSearchParams();
  return useMemo(() => parseFilters(searchParams), [searchParams]);
}
