"use client";

import * as React from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Option } from "@/lib/filter";

/**
 * Themed multi-select dropdown built on Radix DropdownMenu. Radix gives us
 * keyboard nav (↑/↓, Home/End, type-ahead), Esc-to-close, focus return, and
 * portal/collision handling for free. Styling uses the app's CSS variables so
 * it reads correctly in BOTH light and dark themes.
 *
 * `checkbox` items don't auto-close the menu (onSelect preventDefault) so leads
 * can tick several values in one open.
 */

/** Shared trigger button used by every filter dropdown. */
export const FilterTrigger = React.forwardRef<
  HTMLButtonElement,
  {
    label: string;
    /** How many values are selected in this dimension (0 = inactive). */
    count?: number;
    /** A short summary of the current selection, shown when count > 0. */
    summary?: string;
    disabled?: boolean;
  } & React.ButtonHTMLAttributes<HTMLButtonElement>
>(function FilterTrigger(
  { label, count = 0, summary, disabled, className, ...props },
  ref,
) {
  const active = count > 0;
  return (
    <button
      ref={ref}
      type="button"
      disabled={disabled}
      aria-label={
        summary ? `${label}: ${summary}` : `Filter by ${label.toLowerCase()}`
      }
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[12px] font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
        "disabled:cursor-not-allowed disabled:opacity-40",
        active
          ? "border-accent/40 bg-accent/12 text-accent"
          : "border-border-strong bg-surface/60 text-muted hover:bg-elevated hover:text-fg",
        className,
      )}
      {...props}
    >
      <span className="whitespace-nowrap">{label}</span>
      {active ? (
        <span className="tabular grid min-w-4 place-items-center rounded bg-accent/20 px-1 text-[10px] font-semibold text-accent">
          {count}
        </span>
      ) : null}
      <ChevronDown className="size-3.5 shrink-0 opacity-70" />
    </button>
  );
});

const CONTENT_CLASS = cn(
  "z-50 min-w-[13rem] max-w-[18rem] overflow-hidden rounded-lg border border-border-strong bg-elevated p-1 shadow-xl",
  "max-h-[min(22rem,60vh)] overflow-y-auto scroll-slim",
  "animate-in fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-1 data-[side=top]:slide-in-from-bottom-1",
);

/** A multi-select dropdown of checkbox options. */
export function MultiSelectMenu({
  label,
  options,
  selected,
  onToggle,
  onClear,
  emptyText = "No options available.",
  summarize,
}: {
  label: string;
  options: Option[];
  selected: string[];
  onToggle: (value: string) => void;
  onClear: () => void;
  emptyText?: string;
  /** Optional custom summary of the selection for the trigger's aria-label. */
  summarize?: (selected: string[]) => string;
}) {
  const count = selected.length;
  const summary = summarize
    ? summarize(selected)
    : selected.join(", ");
  const disabled = options.length === 0;

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild disabled={disabled}>
        <FilterTrigger
          label={label}
          count={count}
          summary={summary}
          disabled={disabled}
        />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="start" sideOffset={6} className={CONTENT_CLASS}>
          {options.length === 0 ? (
            <div className="px-2 py-3 text-center text-[11.5px] text-faint">
              {emptyText}
            </div>
          ) : (
            <>
              {count > 0 ? (
                <>
                  <DropdownMenu.Item
                    onSelect={(e) => {
                      e.preventDefault();
                      onClear();
                    }}
                    className="flex cursor-pointer items-center rounded-md px-2 py-1.5 text-[11.5px] font-medium text-faint outline-none transition-colors hover:text-fg data-[highlighted]:bg-surface-2 data-[highlighted]:text-fg"
                  >
                    Clear {label.toLowerCase()}
                  </DropdownMenu.Item>
                  <DropdownMenu.Separator className="my-1 h-px bg-border" />
                </>
              ) : null}
              {options.map((opt) => {
                const isOn = selected.includes(opt.value);
                return (
                  <DropdownMenu.CheckboxItem
                    key={opt.value}
                    checked={isOn}
                    onSelect={(e) => e.preventDefault()}
                    onCheckedChange={() => onToggle(opt.value)}
                    className={cn(
                      "flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-[12.5px] outline-none transition-colors",
                      "text-fg/90 data-[highlighted]:bg-surface-2",
                      isOn && "text-fg",
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-4 shrink-0 place-items-center rounded border transition-colors",
                        isOn
                          ? "border-accent bg-accent text-bg"
                          : "border-border-strong bg-transparent",
                      )}
                    >
                      {isOn ? <Check className="size-3" strokeWidth={3} /> : null}
                    </span>
                    <span className="flex-1 truncate">{opt.label}</span>
                    <span className="tabular text-[10.5px] text-faint">
                      {opt.count}
                    </span>
                  </DropdownMenu.CheckboxItem>
                );
              })}
            </>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

/** A single-select dropdown (radio semantics) — used by the Type filter. */
export function SingleSelectMenu({
  label,
  options,
  value,
  onChange,
  allOption,
  emptyText = "No options available.",
}: {
  label: string;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  /** The "all / no constraint" choice shown at the top (e.g. "Epic (all)"). */
  allOption: { value: string; label: string };
  emptyText?: string;
}) {
  const active = value !== "" && value !== allOption.value;
  const current =
    options.find((o) => o.value === value)?.label ?? allOption.label;
  const disabled = options.length === 0;

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild disabled={disabled}>
        <FilterTrigger
          label={label}
          count={active ? 1 : 0}
          summary={current}
          disabled={disabled}
        />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="start" sideOffset={6} className={CONTENT_CLASS}>
          {disabled ? (
            <div className="px-2 py-3 text-center text-[11.5px] text-faint">
              {emptyText}
            </div>
          ) : (
            <DropdownMenu.RadioGroup value={value || allOption.value} onValueChange={onChange}>
              <DropdownMenu.RadioItem
                value={allOption.value}
                className="flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-[12.5px] text-fg/90 outline-none transition-colors data-[highlighted]:bg-surface-2"
              >
                <Dot on={!active} />
                <span className="flex-1 truncate">{allOption.label}</span>
              </DropdownMenu.RadioItem>
              <DropdownMenu.Separator className="my-1 h-px bg-border" />
              {options.map((opt) => (
                <DropdownMenu.RadioItem
                  key={opt.value}
                  value={opt.value}
                  className="flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-[12.5px] text-fg/90 outline-none transition-colors data-[highlighted]:bg-surface-2"
                >
                  <Dot on={value === opt.value} />
                  <span className="flex-1 truncate">{opt.label}</span>
                  <span className="tabular text-[10.5px] text-faint">
                    {opt.count}
                  </span>
                </DropdownMenu.RadioItem>
              ))}
            </DropdownMenu.RadioGroup>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function Dot({ on }: { on: boolean }) {
  return (
    <span
      className={cn(
        "grid size-4 shrink-0 place-items-center rounded-full border transition-colors",
        on ? "border-accent" : "border-border-strong",
      )}
    >
      {on ? <span className="size-2 rounded-full bg-accent" /> : null}
    </span>
  );
}
