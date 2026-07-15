"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
 * The 5 report surfaces — Health, Weekly Deadline, Release Schedule, Bug
 * Analysis, and Effort all have real routes now (Plan 6 wires the last
 * one). `href` stays optional on `Surface` so a future surface without a
 * route yet can still render as a disabled "soon" item, same as every
 * surface here did before its own plan wired it up.
 */
const SURFACES: Surface[] = [
  { key: "health", label: "Health", icon: Activity, href: "/" },
  { key: "weekly-deadline", label: "Weekly Deadline", icon: CalendarClock, href: "/weekly" },
  { key: "release-schedule", label: "Release Schedule", icon: Rocket, href: "/schedule" },
  { key: "bug-analysis", label: "Bug Analysis", icon: Bug, href: "/bugs" },
  { key: "effort", label: "Effort", icon: Gauge, href: "/effort" },
];

/**
 * `usePathname()`-driven active state — needed now that there are two real
 * routes: hardcoding `aria-current="page"` on every linked item (fine when
 * only one route existed) would mislabel Health as "current" while viewing
 * Weekly Deadline and vice versa.
 */
export function Nav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Report views" className="border-b border-border/60 bg-surface/30">
      <div className="mx-auto flex max-w-[1400px] gap-1 overflow-x-auto px-4 py-2 no-scrollbar sm:px-6">
        {SURFACES.map((s) => {
          const Icon = s.icon;
          if (s.href) {
            const active = pathname === s.href;
            return (
              <Link
                key={s.key}
                href={s.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-[12.5px] font-semibold transition-colors",
                  active
                    ? "bg-accent/12 text-accent ring-1 ring-accent/30"
                    : "text-muted hover:bg-elevated/60 hover:text-fg",
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
