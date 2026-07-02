"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "good" | "info" | "warn" | "danger" | "violet" | "muted";

const DOT: Record<Tone, string> = {
  good: "bg-good",
  info: "bg-info",
  warn: "bg-warn",
  danger: "bg-danger",
  violet: "bg-violet",
  muted: "bg-faint",
};

/**
 * Collapsible section wrapper for the Effort tab. Header shows a colored dot,
 * title, count, an optional caption (e.g. man-day totals), and right-aligned
 * extra content. Defaults open.
 */
export function SectionShell({
  title,
  count,
  tone = "muted",
  caption,
  right,
  defaultOpen = true,
  children,
}: {
  title: string;
  count: number;
  tone?: Tone;
  caption?: React.ReactNode;
  right?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <section className="rounded-lg border border-border bg-surface/40">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2.5 px-4 py-3 text-left transition-colors hover:bg-elevated/30"
        aria-expanded={open}
      >
        <span className={cn("size-2 shrink-0 rounded-full", DOT[tone])} />
        <h2 className="text-[13.5px] font-semibold text-fg">{title}</h2>
        <span className="tabular rounded-md bg-elevated px-1.5 py-0.5 text-[11px] font-semibold text-muted">
          {count}
        </span>
        {caption ? (
          <span className="hidden text-[11.5px] text-faint sm:inline">
            {caption}
          </span>
        ) : null}
        <div className="ml-auto flex items-center gap-2">
          {right}
          <ChevronDown
            className={cn(
              "size-4 text-faint transition-transform",
              !open && "-rotate-90",
            )}
          />
        </div>
      </button>
      {open ? <div className="px-3 pb-3">{children}</div> : null}
    </section>
  );
}
