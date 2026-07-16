import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { isBriefOk } from "@/lib/brief";
import { cn } from "@/lib/utils";
import type { AiBrief } from "@/lib/types";
import { SEVERITY_CONTENT } from "./severity";

/**
 * Health-page teaser: `ai_brief.top_finding` + a link to /insights. Renders
 * nothing when the brief is absent or status !== "ok" (isBriefOk gate, same
 * one components/insights/briefing.tsx uses) — a missing/failed brief must
 * never show a broken or empty card on the primary landing view (fail-soft).
 * The brief is expected to already be re-hydrated (pseudonyms → real names) by
 * the Health page before it reaches here.
 */
export function BriefTeaser({ brief }: { brief: AiBrief | null }) {
  if (!isBriefOk(brief)) return null;

  const c = SEVERITY_CONTENT[brief.top_severity ?? "low"];

  return (
    <Link
      href="/insights"
      className="group relative flex items-center gap-3 overflow-hidden rounded-lg bg-surface/70 p-4 ring-1 ring-accent/25 backdrop-blur-sm transition-all hover:-translate-y-px hover:bg-surface"
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-accent/10 to-transparent opacity-70" />
      <div className={cn("relative flex size-8 shrink-0 items-center justify-center rounded-md ring-1", c.bg, c.ring)}>
        <Sparkles className={cn("size-4", c.text)} />
      </div>
      <div className="relative min-w-0 flex-1">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted">AI briefing</span>
        <p className="mt-0.5 line-clamp-2 text-[13px] font-medium text-fg">{brief.top_finding}</p>
      </div>
      <ArrowRight className="relative size-4 shrink-0 text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
    </Link>
  );
}
