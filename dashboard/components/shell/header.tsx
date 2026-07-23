import Link from "next/link";
import { AlertTriangle, Radar, Settings } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { DualClock } from "@/components/shell/dual-clock";
import { SignOutButton } from "@/components/shell/sign-out-button";
import { TzToggle } from "@/components/shell/tz-toggle";
import { fmtTimeShort, tzLabel } from "@/lib/format";
import { currentTz, currentTzPref } from "@/lib/tz-server";

// Older than this and the header flags the data as stale: the widest gap in
// the default schedule (19:00 → 08:00 is overnight, so daytime gaps max ~4h;
// 3.5h covers slot gap + run time + margin without false-flagging weekends
// during off-hours less usefully than it warns during the workday).
const STALE_MS = 3.5 * 60 * 60 * 1000;

/**
 * Sticky app header (async server component: reads the tz cookies itself so
 * all pages keep their existing <Header .../> call sites). "as of" renders in
 * the viewer's zone (it was a raw UTC HH:MM before — confusing for an
 * IST/SAST team); a staleness chip appears when the snapshot is older than
 * 3.5h so stale data announces itself instead of silently reading as current.
 */
export async function Header({
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
  const tz = await currentTz();
  const pref = await currentTzPref();
  const parsed = new Date(generatedAtIso).getTime();
  const genMs = Number.isFinite(parsed) ? parsed : null;
  const asOfLocal = genMs != null ? `${fmtTimeShort(genMs, tz)} ${tzLabel(tz)}` : asOf;
  const ageMs = genMs != null ? Date.now() - genMs : null;
  const staleHours = ageMs != null && ageMs > STALE_MS ? Math.round(ageMs / 3_600_000) : null;

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
            {staleHours != null ? (
              <span className="inline-flex items-center gap-1 rounded bg-warn/12 px-1.5 py-0.5 text-[10px] font-semibold text-warn ring-1 ring-warn/30">
                <AlertTriangle className="size-3" />
                data {staleHours}h old
              </span>
            ) : null}
          </div>
          <p className="truncate text-[11.5px] text-muted">
            <span className="font-medium text-fg/90">{project}</span>
            <span className="mx-1 text-faint">·</span>
            {scope}
            <span className="mx-1 text-faint">·</span>
            as of <span className="tabular font-medium text-fg/90">{asOfLocal}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DualClock generatedAtIso={generatedAtIso} asOf={asOf} />
          <TzToggle pref={pref} resolvedLabel={tzLabel(tz)} />
          <Link
            href="/admin"
            aria-label="Admin"
            className="flex size-8 items-center justify-center rounded-md border border-border bg-surface/60 text-muted transition hover:text-fg"
          >
            <Settings className="size-4" />
          </Link>
          <ThemeToggle />
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
