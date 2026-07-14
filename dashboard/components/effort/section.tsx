"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

/**
 * The 6 Effort Report section tones (docs/reports-dashboard/plans/
 * 06-effort.md Task 2 / PRD_3 §5's S0-S5 table). The PRD's own styling
 * section paints most section headers a uniform blue (`#2c5282`) with S4
 * purple (`#5b4a8a`) and S5 violet (`#6a1b9a`) as the two standouts — this
 * app's token palette has only one violet hue (no separate purple), so S4
 * and S5 share `violet` (same "reuse existing hues" approach documented in
 * components/weekly/badge-tone.ts). The other sections get a tone that
 * signals their own state instead of a flat blue: `good` for done, `warn`
 * for all-pending (matches the "Pending" stat's tone in release-kpi.tsx /
 * weekly/kpi-cards.tsx), `info` for mixed, `outline` for the no-stories
 * edge case.
 */
export type EffortSectionTone = "good" | "warn" | "info" | "outline" | "violet";

const TONE_STYLE: Record<EffortSectionTone, { rail: string; header: string; text: string }> = {
  good: { rail: "border-l-good", header: "bg-good/[0.08] hover:bg-good/[0.12]", text: "text-good" },
  warn: { rail: "border-l-warn", header: "bg-warn/[0.08] hover:bg-warn/[0.12]", text: "text-warn" },
  info: { rail: "border-l-info", header: "bg-info/[0.08] hover:bg-info/[0.12]", text: "text-info" },
  outline: {
    rail: "border-l-border-strong",
    header: "bg-elevated/40 hover:bg-elevated/60",
    text: "text-faint",
  },
  violet: { rail: "border-l-violet", header: "bg-violet/[0.08] hover:bg-violet/[0.12]", text: "text-violet" },
};

/**
 * Collapsible section shell shared by all 6 Effort Report sections (mirrors
 * the established pattern from components/release/milestone-section.tsx and
 * components/bugs/section.tsx): colored left rail + header, click to toggle,
 * optional count badge on the right.
 */
export function Section({
  title,
  tone,
  count,
  defaultOpen = true,
  children,
}: {
  title: string;
  tone: EffortSectionTone;
  count?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  const style = TONE_STYLE[tone];

  return (
    <Card className={cn("overflow-hidden border-l-4", style.rail)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          "flex w-full flex-wrap items-center gap-2 px-4 py-3 text-left transition-colors",
          style.header,
        )}
      >
        <ChevronDown className={cn("size-4 shrink-0 transition-transform", style.text, !open && "-rotate-90")} />
        <span className={cn("text-[13.5px] font-semibold", style.text)}>{title}</span>
        {count != null ? (
          <span className={cn("tabular ml-auto text-[12px] font-medium", style.text)}>
            {count.toLocaleString()}
          </span>
        ) : null}
      </button>
      {open ? <div className="border-t border-border/60">{children}</div> : null}
    </Card>
  );
}
