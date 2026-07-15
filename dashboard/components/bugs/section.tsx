"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

/**
 * The 4 Bug Analysis section colors (docs/reports-dashboard/plans/
 * 05-bug-analysis.md Task 2 / PRD_1 §5): dark-red (§1 new bugs), red (§2
 * older-open High), amber (§3 state breakdown), indigo (§4 module insights).
 * The token palette maps these onto existing design tokens rather than the
 * PRD's literal hex values — same "reuse existing hues, don't invent new
 * ones" approach documented in components/weekly/badge-tone.ts. `danger` vs
 * `danger-dim` gives §1/§2 two genuinely distinct-but-related red tokens
 * (already defined in app/globals.css) instead of an improvised opacity
 * ramp; `violet` stands in for indigo as the closest available hue.
 */
export type SectionTone = "danger" | "danger-dim" | "warn" | "violet";

const TONE_STYLE: Record<SectionTone, { rail: string; header: string; text: string }> = {
  danger: { rail: "border-l-danger", header: "bg-danger/[0.08] hover:bg-danger/[0.12]", text: "text-danger" },
  "danger-dim": {
    rail: "border-l-danger-dim",
    header: "bg-danger-dim/[0.08] hover:bg-danger-dim/[0.12]",
    text: "text-danger-dim",
  },
  warn: { rail: "border-l-warn", header: "bg-warn/[0.08] hover:bg-warn/[0.12]", text: "text-warn" },
  violet: { rail: "border-l-violet", header: "bg-violet/[0.08] hover:bg-violet/[0.12]", text: "text-violet" },
};

/**
 * Collapsible section shell shared by all 4 Bug Analysis sections (mirrors
 * the collapsible pattern from components/release/milestone-section.tsx and
 * components/weekly/week-section.tsx): colored left rail + header, click to
 * toggle, optional count badge on the right. `defaultOpen` lets the page
 * open every section by default (PRD_1 doesn't call for any section to
 * start collapsed).
 */
export function Section({
  title,
  tone,
  count,
  defaultOpen = true,
  children,
}: {
  title: string;
  tone: SectionTone;
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
