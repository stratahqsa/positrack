import { Radar } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { DualClock } from "@/components/shell/dual-clock";
import { SignOutButton } from "@/components/shell/sign-out-button";

/**
 * Sticky app header. Shows product identity + snapshot freshness — the data
 * is snapshot-based, so the "as of HH:MM" stamp (and the generated-at date
 * folded into the dual clock) is how the UI stays honest about staleness.
 * A server component: ThemeToggle/SignOutButton are self-contained client
 * islands, so the header itself needs no client state.
 */
export function Header({
  project,
  scope,
  asOf,
  generatedAtIso,
}: {
  project: string;
  scope: string;
  asOf: string;
  generatedAtIso: string;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-border/80 glass">
      <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-4 py-3 sm:px-6">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent/12 ring-1 ring-accent/30">
          <Radar className="size-5 text-accent" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-[15px] font-semibold tracking-tight text-fg">
              POSX Reports
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
            as of <span className="tabular font-medium text-fg/90">{asOf}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DualClock generatedAtIso={generatedAtIso} asOf={asOf} />
          <ThemeToggle />
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
