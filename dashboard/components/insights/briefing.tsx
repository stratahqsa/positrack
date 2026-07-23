import Link from "next/link";
import { CheckCircle2, CloudOff } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IssueLink } from "@/components/ui/issue-link";
import { fmtDateTime, tzLabel } from "@/lib/format";
import { briefAgeMs, formatBriefAge, isBriefOk } from "@/lib/brief";
import { cn } from "@/lib/utils";
import type { AiBrief, AiBriefItem, AiBriefSource } from "@/lib/types";
import { SEVERITY_CONTENT } from "./severity";

/**
 * A finding's provenance, rendered as a clickable citation chip (shapeof.ai
 * "Citations"/"Footprints" — every AI claim traces to a real, clickable
 * source). `issueId` → the YouTrack ticket; `href` → an internal dashboard
 * view; otherwise a plain readable label.
 */
function SourceChip({ source }: { source?: AiBriefSource }) {
  if (!source) return null;
  if (source.issueId) {
    return <IssueLink id={source.issueId} label={source.label} showIcon={false} className="shrink-0 text-[10.5px]" />;
  }
  const chrome =
    "shrink-0 rounded bg-elevated px-1.5 py-0.5 text-[10px] text-muted transition-colors";
  if (source.href) {
    return (
      <Link href={source.href} className={cn(chrome, "hover:text-accent")}>
        {source.label}
      </Link>
    );
  }
  return <span className={cn(chrome, "text-faint")}>{source.label}</span>;
}

function Finding({ item }: { item: AiBriefItem }) {
  const c = SEVERITY_CONTENT[item.severity ?? "low"];
  const Icon = c.icon;
  return (
    <li className={cn("flex flex-wrap items-start justify-between gap-x-3 gap-y-1 border-l-2 py-0.5 pl-3", c.rail)}>
      <span className="flex min-w-[60%] flex-1 items-start gap-2 text-[13px] leading-relaxed text-fg/90">
        <Icon className={cn("mt-0.5 size-3.5 shrink-0", c.text)} aria-label={c.label} />
        {item.text}
      </span>
      <SourceChip source={item.source} />
    </li>
  );
}

/** "Generated 42 min ago · 16 Jul 2026, 8:42 AM IST · deepseek/deepseek-chat" —
 *  relative age (formatBriefAge, render-time) + absolute IST stamp + model. */
function GeneratedAtLine({ brief, nowMs, tz }: { brief: AiBrief; nowMs: number; tz: string }) {
  return (
    <p className="text-[11px] text-faint">
      Generated {formatBriefAge(briefAgeMs(brief, nowMs))}
      <span className="mx-1">·</span>
      {fmtDateTime(brief.generated_at, tz)} {tzLabel(tz)}
      <span className="mx-1">·</span>
      <span className="font-mono">{brief.model_id}</span>
    </p>
  );
}

/**
 * Renders the AI-generated proactive briefing (top issues, since-last-snapshot
 * deltas, most-behind people). Three states, gated purely by lib/brief.ts's
 * isBriefOk + brief.empty so this can never disagree with the Health teaser
 * (components/insights/brief-teaser.tsx) about availability:
 *  - unavailable: status !== "ok" or ai_brief absent (generation failed/skipped
 *    — fail-soft, never an error page).
 *  - empty: status "ok" but nothing notable (an all-green cycle).
 *  - ok: the 3 sections. Each finding leads with a DATA-derived severity icon
 *    (color = urgency) and trails a clickable citation to its source. Read the
 *    text as hedged hypotheses, not facts (see the trust note at the bottom).
 *
 * The brief is expected to already be re-hydrated (pseudonyms → real names) by
 * the page via lib/brief.ts::rehydrateBrief before it reaches here.
 */
export function Briefing({ brief, nowMs, tz }: { brief: AiBrief | null; nowMs: number; tz: string }) {
  if (!isBriefOk(brief)) {
    return (
      <section
        aria-label="AI briefing unavailable"
        className="rounded-lg border border-dashed border-border bg-surface/30 px-4 py-10 text-center"
      >
        <CloudOff className="mx-auto size-6 text-faint" aria-hidden="true" />
        <p className="mt-3 text-[13px] font-medium text-muted">
          The AI briefing couldn&apos;t be generated this cycle.
        </p>
        <p className="mt-1 text-[12px] text-faint">
          {brief?.reason ?? "It regenerates automatically on the next scheduled snapshot."}
        </p>
      </section>
    );
  }

  if (brief.empty) {
    return (
      <section
        aria-label="AI briefing: nothing notable"
        className="rounded-lg border border-good/30 bg-good/[0.06] px-4 py-10 text-center"
      >
        <CheckCircle2 className="mx-auto size-6 text-good" aria-hidden="true" />
        <p className="mt-3 text-[13px] font-medium text-fg">Nothing notable this cycle.</p>
        {brief.top_finding ? <p className="mt-1 text-[12px] text-muted">{brief.top_finding}</p> : null}
        <div className="mt-4 flex justify-center">
          <GeneratedAtLine brief={brief} nowMs={nowMs} tz={tz} />
        </div>
      </section>
    );
  }

  return (
    <section aria-label="AI briefing" className="space-y-4">
      <GeneratedAtLine brief={brief} nowMs={nowMs} tz={tz} />

      <div className="space-y-4">
        {brief.sections.map((section) => (
          <Card key={section.title}>
            <CardHeader>
              <CardTitle>{section.title}</CardTitle>
            </CardHeader>
            <CardContent>
              {section.items.length === 0 ? (
                <p className="text-[12px] text-faint">No items in this section.</p>
              ) : (
                <ul className="space-y-2.5">
                  {section.items.map((item, i) => (
                    <Finding key={i} item={item} />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-[11px] text-faint">
        AI-generated from the snapshot data — each finding is coloured by severity and cites its
        source; treat the reasons as likely explanations, not confirmed facts.
      </p>
    </section>
  );
}
