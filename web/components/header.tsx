"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Radar, Clock, LogOut, Loader2 } from "lucide-react";

/**
 * Sticky app header. Always visible. Shows project context + freshness stamp
 * (Consensus: the UI must stamp "as of HH:MM" because data is snapshot-based).
 */
export function Header({
  project,
  scope,
  sprint,
  asOf,
  generatedAtIso,
}: {
  project: string;
  scope: string;
  sprint: string;
  asOf: string;
  generatedAtIso: string;
}) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = React.useState(false);

  const date = React.useMemo(() => {
    try {
      return new Date(generatedAtIso).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
      });
    } catch {
      return "";
    }
  }, [generatedAtIso]);

  async function logout() {
    setLoggingOut(true);
    try {
      await fetch("/api/login", { method: "DELETE" });
      router.replace("/login");
      router.refresh();
    } catch {
      setLoggingOut(false);
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 glass">
      <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-4 py-3 sm:px-6">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent/12 ring-1 ring-accent/30">
          <Radar className="size-5 text-accent" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-[15px] font-semibold tracking-tight text-fg">
              POSX Control Tower
            </h1>
            <span className="hidden rounded bg-elevated px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-faint sm:inline">
              Beta
            </span>
          </div>
          <p className="truncate text-[11.5px] text-muted">
            <span className="font-medium text-fg/90">{project}</span>
            <span className="mx-1 text-faint">·</span>
            {scope}
            <span className="mx-1 text-faint">·</span>
            sprint {sprint}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-1.5 rounded-md border border-border bg-surface/60 px-2.5 py-1.5 text-[11px] text-muted sm:flex">
            <Clock className="size-3.5 text-accent" />
            as of <span className="tabular font-semibold text-fg">{asOf}</span>
            {date ? <span className="text-faint">· {date}</span> : null}
          </div>
          <button
            onClick={logout}
            disabled={loggingOut}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface/60 px-2.5 py-1.5 text-[11px] font-medium text-muted transition-colors hover:border-border-strong hover:text-fg disabled:opacity-60"
            aria-label="Sign out"
          >
            {loggingOut ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <LogOut className="size-3.5" />
            )}
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </div>
    </header>
  );
}
