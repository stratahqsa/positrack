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
 * ticket references) across the report views.
 */
export function IssueLink({
  id,
  className,
  showIcon = true,
}: {
  id: string;
  className?: string;
  showIcon?: boolean;
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
      {id}
      {showIcon ? (
        <ArrowUpRight className="size-3 opacity-0 transition-opacity group-hover:opacity-100" />
      ) : null}
    </a>
  );
}
