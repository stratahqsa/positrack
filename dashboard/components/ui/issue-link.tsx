import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

const ISSUE_BASE_URL = "https://support.posibolt.com/issue/";

/** Builds the tracker URL for an issue id (story, bug, or dev-ticket id). */
export function issueUrl(id: string): string {
  return `${ISSUE_BASE_URL}${id}`;
}

/**
 * Link to a YouTrack issue. Opens in a new tab. Monospaced id — shared by
 * every place an issue id is rendered (story rows, bug drill-down rows, dev
 * ticket references) across the report views. `label` overrides the visible
 * text (still linking to `id`'s URL) — used by the AI briefing's citation
 * chips (components/insights/briefing.tsx), which show a human-readable
 * `source.label` rather than the bare id; every other call site omits it and
 * gets the original id-as-text behavior unchanged.
 */
export function IssueLink({
  id,
  className,
  showIcon = true,
  label,
}: {
  id: string;
  className?: string;
  showIcon?: boolean;
  label?: string;
}) {
  return (
    <a
      href={issueUrl(id)}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "group inline-flex items-center gap-0.5 font-mono text-[12px] font-medium text-accent/90 transition-colors hover:text-accent",
        className,
      )}
    >
      {label ?? id}
      {showIcon ? (
        <ArrowUpRight className="size-3 opacity-0 transition-opacity group-hover:opacity-100" />
      ) : null}
    </a>
  );
}
