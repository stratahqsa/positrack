import { Clock } from "lucide-react";

/**
 * SAST/IST dual clock, ported from web/components/header.tsx. The team spans
 * South Africa and India, so both zones are always shown, computed from the
 * same instant (the snapshot's generated_at_iso) so they can't drift apart or
 * depend on the server's own timezone. Pure display — no client state needed,
 * so this stays a server component.
 */
export function DualClock({
  generatedAtIso,
  asOf,
}: {
  generatedAtIso: string;
  asOf: string;
}) {
  let date = "";
  try {
    date = new Date(generatedAtIso).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
    });
  } catch {
    date = "";
  }

  let sast = asOf;
  let ist = asOf;
  try {
    const d = new Date(generatedAtIso);
    const fmt = (timeZone: string) =>
      new Intl.DateTimeFormat("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone,
      }).format(d);
    sast = fmt("Africa/Johannesburg");
    ist = fmt("Asia/Kolkata");
  } catch {
    // fall back to asOf for both, assigned above
  }

  return (
    <div className="hidden items-center gap-1.5 rounded-md border border-border bg-surface/60 px-2.5 py-1.5 text-[11px] text-muted sm:flex">
      <Clock className="size-3.5 text-accent" />
      <span className="tabular font-semibold text-fg">{sast}</span> SAST
      <span className="text-faint">·</span>
      <span className="tabular font-semibold text-fg">{ist}</span> IST
      {date ? <span className="text-faint">· {date}</span> : null}
    </div>
  );
}
