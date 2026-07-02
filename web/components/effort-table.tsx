"use client";

import * as React from "react";
import { ChevronRight, User, UserCog, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Epic, Story } from "@/lib/types";
import {
  md,
  fmtDate,
  epicFlags,
  spentPct,
  stateTone,
  isUnowned,
  rollupTotal,
  type EpicFlags,
} from "@/lib/format";
import {
  storyMatchesType,
  type RedFilter,
  type SortKey,
} from "@/lib/filter";
import { useFilters } from "@/components/filter-context";
import { IssueLink } from "@/components/issue-link";
import { FlagChips } from "@/components/flag-chips";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

/**
 * Assignee cell — loud when the epic needs an owner. Blank → "unowned";
 * parked on a role placeholder → the role name shown in danger with a "needs
 * owner" hint, so it never masquerades as truly owned.
 */
function Assignee({ name, flags }: { name: string; flags: EpicFlags }) {
  if (flags.needsOwner) {
    if (flags.roleOwner) {
      return (
        <span
          className="inline-flex items-center gap-1 rounded bg-danger/12 px-1.5 py-0.5 text-[11px] font-medium text-danger ring-1 ring-danger/25"
          title={`Parked on a role account (${name.trim()}) — assign a person`}
        >
          <UserCog className="size-3" />
          <span className="max-w-[120px] truncate">{name.trim()}</span>
          <span className="text-danger/70">· needs owner</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded bg-danger/12 px-1.5 py-0.5 text-[11px] font-medium text-danger ring-1 ring-danger/25">
        <User className="size-3" /> unowned
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[12px] text-fg/90">
      <span className="grid size-4 place-items-center rounded-full bg-elevated text-[9px] font-semibold uppercase text-muted ring-1 ring-border-strong">
        {name.trim().charAt(0)}
      </span>
      <span className="max-w-[120px] truncate">{name}</span>
    </span>
  );
}

function NumCell({
  minutes,
  className,
}: {
  minutes: number;
  className?: string;
}) {
  return (
    <td
      className={cn(
        "px-2 py-2 text-right tabular text-[12.5px]",
        minutes ? "text-fg/90" : "text-faint",
        className,
      )}
    >
      {md(minutes)}
    </td>
  );
}

/** Clickable epic-state pill → sets the State filter. */
function StatePill({ state }: { state: string }) {
  const { filters, toggle } = useFilters();
  if (!state) return <span className="text-faint">—</span>;
  const active = filters.states.includes(state);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        toggle("states", state);
      }}
      aria-pressed={active}
      title={`Filter by state: ${state}`}
      className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
    >
      <Badge
        variant={stateTone(state)}
        size="sm"
        className={cn(
          "cursor-pointer transition-transform hover:-translate-y-px",
          active && "ring-2 ring-accent/60",
        )}
      >
        {state}
      </Badge>
    </button>
  );
}

function StoriesPanel({
  epic,
  activeType,
}: {
  epic: Epic;
  activeType: string;
}) {
  if (!epic.stories.length) {
    return (
      <div className="px-4 py-3 text-[12px] text-faint">
        No stories linked to this epic.
      </div>
    );
  }
  return (
    <div className="overflow-hidden">
      <table className="w-full border-collapse">
        <thead>
          <tr className="text-[10px] uppercase tracking-wide text-faint">
            <th className="py-1.5 pl-11 pr-2 text-left font-medium">Story</th>
            <th className="px-2 py-1.5 text-left font-medium">Summary</th>
            {activeType ? (
              <th className="px-2 py-1.5 text-left font-medium">Type</th>
            ) : null}
            <th className="px-2 py-1.5 text-left font-medium">State</th>
            <th className="px-2 py-1.5 text-left font-medium">Scope</th>
            <th className="px-2 py-1.5 text-left font-medium">Owner</th>
            <th className="px-2 py-1.5 text-right font-medium">Dev</th>
            <th className="px-2 py-1.5 text-right font-medium">UI</th>
            <th className="px-2 py-1.5 text-right font-medium">QA</th>
            <th className="px-3 py-1.5 text-right font-medium">Est</th>
          </tr>
        </thead>
        <tbody>
          {epic.stories.map((s) => {
            const est = rollupTotal(s.est);
            // When a child type is filtered, matching rows stay bright and
            // non-matching rows dim (still visible for context).
            const dim = activeType ? !storyMatchesType(s, activeType) : false;
            const match = activeType ? storyMatchesType(s, activeType) : false;
            return (
              <tr
                key={s.id}
                className={cn(
                  "border-t border-border/50 text-[12px] transition-colors hover:bg-elevated/40",
                  dim && "opacity-40",
                  match && "bg-accent/[0.05]",
                )}
              >
                <td className="py-1.5 pl-11 pr-2 align-top">
                  <IssueLink id={s.id} showIcon={false} />
                </td>
                <td className="max-w-[320px] px-2 py-1.5 align-top text-fg/80">
                  <span className="line-clamp-2">{s.summary}</span>
                </td>
                {activeType ? (
                  <td className="px-2 py-1.5 align-top">
                    {s.type ? (
                      <Badge variant={match ? "accent" : "outline"} size="sm">
                        {s.type}
                      </Badge>
                    ) : (
                      <span className="text-[11px] text-faint">—</span>
                    )}
                  </td>
                ) : null}
                <td className="px-2 py-1.5 align-top">
                  <Badge variant={stateTone(s.state)} size="sm">
                    {s.state}
                  </Badge>
                </td>
                <td className="px-2 py-1.5 align-top text-[11px] text-muted">
                  {s.scope}
                </td>
                <td className="px-2 py-1.5 align-top">
                  {isUnowned(s.assignee) ? (
                    <span className="text-[11px] text-danger/80">unowned</span>
                  ) : (
                    <span className="text-[11px] text-fg/80">{s.assignee}</span>
                  )}
                </td>
                <td className="px-2 py-1.5 text-right tabular text-fg/70">
                  {md(s.est.server)}
                </td>
                <td className="px-2 py-1.5 text-right tabular text-fg/70">
                  {md(s.est.ui)}
                </td>
                <td className="px-2 py-1.5 text-right tabular text-fg/70">
                  {md(s.est.testing)}
                </td>
                <td className="px-3 py-1.5 text-right tabular font-medium text-fg/90">
                  {md(est)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function EpicRow({
  epic,
  expandable,
  activeType,
  onFilterRed,
  activeReds,
  colSpan,
}: {
  epic: Epic;
  expandable: boolean;
  activeType: string;
  onFilterRed: (red: RedFilter) => void;
  activeReds: RedFilter[];
  colSpan: number;
}) {
  const f = epicFlags(epic);
  const pct = spentPct(epic);
  const canExpand = expandable && epic.stories.length > 0;

  // Auto-open when a child-type filter is active and this epic has a match, so
  // the matching child rows are revealed without a manual click.
  const hasTypeMatch =
    !!activeType &&
    (epic.stories ?? []).some((s: Story) => storyMatchesType(s, activeType));
  const [manualOpen, setManualOpen] = React.useState(false);
  // Track the last activeType we auto-synced against so a user can still
  // collapse a row after auto-expand without it snapping back every render.
  const [autoKey, setAutoKey] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (activeType && hasTypeMatch && autoKey !== activeType) {
      setManualOpen(true);
      setAutoKey(activeType);
    }
    if (!activeType && autoKey !== null) {
      setManualOpen(false);
      setAutoKey(null);
    }
  }, [activeType, hasTypeMatch, autoKey]);

  const open = canExpand && manualOpen;

  return (
    <>
      <tr
        className={cn(
          "border-t border-border/60 transition-colors",
          canExpand && "cursor-pointer",
          f.overshoot
            ? "amber-rail hover:bg-warn/[0.06]"
            : f.needsOwner
              ? "red-rail hover:bg-danger/[0.05]"
              : "hover:bg-elevated/40",
        )}
        onClick={canExpand ? () => setManualOpen((v) => !v) : undefined}
        aria-expanded={canExpand ? open : undefined}
      >
        <td className="py-2 pl-2 pr-1 align-top">
          <div className="flex items-center gap-1">
            {canExpand ? (
              <ChevronRight
                className={cn(
                  "size-3.5 shrink-0 text-faint transition-transform",
                  open && "rotate-90 text-muted",
                )}
              />
            ) : (
              <span className="inline-block size-3.5" />
            )}
            <IssueLink id={epic.id} showIcon={false} />
          </div>
        </td>
        <td className="max-w-[300px] px-2 py-2 align-top">
          <span className="line-clamp-2 text-[12.5px] text-fg/90">
            {epic.summary}
          </span>
          <div className="mt-0.5 flex items-center gap-1.5">
            <StatePill state={epic.epic_state} />
            {epic.stories.length ? (
              <span className="text-[10.5px] text-faint">
                {epic.stories.length}{" "}
                {epic.stories.length === 1 ? "story" : "stories"}
                {hasTypeMatch ? (
                  <span className="ml-1 text-accent">· match</span>
                ) : null}
              </span>
            ) : null}
          </div>
        </td>
        <td className="px-2 py-2 align-top">
          <Assignee name={epic.assignee} flags={f} />
        </td>
        <td className="px-2 py-2 align-top text-[11.5px] text-muted whitespace-nowrap">
          {fmtDate(epic.created)}
        </td>
        <NumCell minutes={epic.rollup.server} />
        <NumCell minutes={epic.rollup.ui} />
        <NumCell minutes={epic.rollup.testing} />
        <td className="px-2 py-2 text-right align-top">
          <span className="tabular text-[12.5px] font-semibold text-fg">
            {md(epic.total)}
          </span>
        </td>
        <td className="px-2 py-2 align-top">
          <div className="flex flex-col items-end gap-1">
            <span
              className={cn(
                "tabular text-[12.5px] font-medium",
                f.overshoot ? "text-warn" : epic.spent ? "text-fg/90" : "text-faint",
              )}
            >
              {md(epic.spent)}
            </span>
            {epic.total > 0 || epic.spent > 0 ? (
              <Progress
                value={pct}
                tone={f.overshoot ? "warn" : pct >= 85 ? "info" : "good"}
                className="!h-1"
                trackClassName="!h-1 w-16"
              />
            ) : null}
          </div>
        </td>
        <td className="px-2 py-2 pr-3 align-top">
          <FlagChips epic={epic} onFilter={onFilterRed} activeRed={activeReds} />
        </td>
      </tr>
      {open ? (
        <tr className="bg-bg/40">
          <td colSpan={colSpan} className="p-0">
            <div className="border-l-2 border-accent/30 bg-surface/30">
              <StoriesPanel epic={epic} activeType={activeType} />
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

/** Sort-aware column header (right-aligned numeric columns). */
function SortHeader({
  label,
  sortKey,
  align = "right",
  className,
}: {
  label: string;
  sortKey: SortKey;
  align?: "left" | "right";
  className?: string;
}) {
  const { filters, cycleSort } = useFilters();
  const active = filters.sort?.key === sortKey;
  const dir = active ? filters.sort!.dir : undefined;
  return (
    <th className={cn("px-2 py-2 font-semibold", className)}>
      <button
        type="button"
        onClick={() => cycleSort(sortKey)}
        aria-label={`Sort by ${label}${
          active ? ` (${dir === "asc" ? "ascending" : "descending"})` : ""
        }`}
        className={cn(
          "inline-flex items-center gap-1 rounded transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
          align === "right" && "flex-row-reverse",
          active ? "text-accent" : "text-faint",
        )}
      >
        {label}
        {active ? (
          dir === "asc" ? (
            <ArrowUp className="size-3" />
          ) : (
            <ArrowDown className="size-3" />
          )
        ) : (
          <ArrowDown className="size-3 opacity-0 transition-opacity group-hover:opacity-40" />
        )}
      </button>
    </th>
  );
}

/** Full section table with header + epic rows. */
export function EffortTable({
  epics,
  expandable = true,
  activeType = "",
}: {
  epics: Epic[];
  expandable?: boolean;
  /** Active child-type filter — drives auto-expand + child dimming. */
  activeType?: string;
}) {
  const { filters, setRed, toggleRed } = useFilters();
  const activeReds = filters.reds;

  // Clicking a row's flag chip toggles that single RED filter (so click again
  // clears it); if other RED filters are set we replace them for clarity.
  const onFilterRed = React.useCallback(
    (red: RedFilter) => {
      if (filters.reds.length === 1 && filters.reds[0] === red) {
        toggleRed(red); // clears it
      } else {
        setRed(red);
      }
    },
    [filters.reds, setRed, toggleRed],
  );

  if (!epics.length) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-surface/30 px-4 py-8 text-center text-[12.5px] text-faint">
        No epics match in this section.
      </div>
    );
  }
  const colSpan = 10;
  return (
    <div className="group overflow-x-auto rounded-lg border border-border bg-surface/40 scroll-slim">
      <table className="w-full min-w-[880px] border-collapse">
        <thead className="sticky top-0 z-10 bg-surface-2/95 backdrop-blur">
          <tr className="text-[10px] uppercase tracking-wide text-faint">
            <th className="py-2 pl-2 pr-1 text-left font-semibold">Epic</th>
            <th className="px-2 py-2 text-left font-semibold">Summary</th>
            <th className="px-2 py-2 text-left font-semibold">Assignee</th>
            <SortHeader label="Created" sortKey="created" align="left" className="text-left" />
            <th className="px-2 py-2 text-right font-semibold">Dev</th>
            <th className="px-2 py-2 text-right font-semibold">UI</th>
            <th className="px-2 py-2 text-right font-semibold">QA</th>
            <SortHeader label="Total" sortKey="total" className="text-right" />
            <SortHeader label="Spent" sortKey="spent" className="text-right" />
            <SortHeader
              label="Flags"
              sortKey="overshoot"
              align="left"
              className="pr-3 text-left"
            />
          </tr>
        </thead>
        <tbody>
          {epics.map((e) => (
            <EpicRow
              key={e.id}
              epic={e}
              expandable={expandable}
              activeType={activeType}
              onFilterRed={onFilterRed}
              activeReds={activeReds}
              colSpan={colSpan}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
