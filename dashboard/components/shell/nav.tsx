import Link from "next/link";
import { Activity, CalendarClock, Rocket, Bug, Gauge } from "lucide-react";
import { cn } from "@/lib/utils";

interface Surface {
  key: string;
  label: string;
  icon: typeof Activity;
  /** Present only for surfaces with a real route; absent renders as disabled "soon". */
  href?: string;
}

/**
 * The 5 report surfaces. Only Health has a real route today (Plans 3-6 wire
 * the rest) — the other 4 render as disabled "soon" items so the full shape
 * of the dashboard is visible from day one without dead links.
 */
const SURFACES: Surface[] = [
  { key: "health", label: "Health", icon: Activity, href: "/" },
  { key: "weekly-deadline", label: "Weekly Deadline", icon: CalendarClock },
  { key: "release-schedule", label: "Release Schedule", icon: Rocket },
  { key: "bug-analysis", label: "Bug Analysis", icon: Bug },
  { key: "effort", label: "Effort", icon: Gauge },
];

export function Nav() {
  return (
    <nav aria-label="Report views" className="border-b border-border/60 bg-surface/30">
      <div className="mx-auto flex max-w-[1400px] gap-1 overflow-x-auto px-4 py-2 no-scrollbar sm:px-6">
        {SURFACES.map((s) => {
          const Icon = s.icon;
          if (s.href) {
            return (
              <Link
                key={s.key}
                href={s.href}
                aria-current="page"
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-md bg-accent/12 px-3 py-1.5 text-[12.5px] font-semibold text-accent ring-1 ring-accent/30",
                )}
              >
                <Icon className="size-3.5" />
                {s.label}
              </Link>
            );
          }
          return (
            <span
              key={s.key}
              aria-disabled="true"
              title={`${s.label} — coming soon`}
              className="inline-flex shrink-0 cursor-not-allowed items-center gap-1.5 rounded-md px-3 py-1.5 text-[12.5px] font-medium text-faint"
            >
              <Icon className="size-3.5" />
              {s.label}
              <span className="rounded bg-elevated px-1 py-0.5 text-[9.5px] font-medium uppercase tracking-wide text-faint">
                soon
              </span>
            </span>
          );
        })}
      </div>
    </nav>
  );
}
