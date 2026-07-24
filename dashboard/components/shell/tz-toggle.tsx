"use client";

import { useRouter } from "next/navigation";
import { Globe } from "lucide-react";
import { IST, SAST, TZ_COOKIE, type TzPref } from "@/lib/tz";

const NEXT: Record<TzPref, TzPref> = { auto: IST, [IST]: SAST, [SAST]: "auto" };

/**
 * Cycles the per-browser timezone preference: Auto → IST → SAST → Auto.
 * Cookie + router.refresh() → the server re-renders every timestamp in the
 * new zone (no client-side reformatting anywhere). Saved per browser — the
 * shared viewer PIN means a global setting was never an option.
 */
export function TzToggle({ pref, resolvedLabel }: { pref: TzPref; resolvedLabel: string }) {
  const router = useRouter();
  const label = pref === "auto" ? `Auto · ${resolvedLabel}` : resolvedLabel;
  function cycle() {
    document.cookie = `${TZ_COOKIE}=${encodeURIComponent(NEXT[pref])}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }
  return (
    <button
      onClick={cycle}
      title="Timezone for timestamps (saved in this browser)"
      className="hidden items-center gap-1.5 rounded-md border border-border bg-surface/60 px-2.5 py-1.5 text-[11px] font-medium text-muted transition hover:text-fg sm:flex"
    >
      <Globe className="size-3.5 text-accent" />
      {label}
    </button>
  );
}
