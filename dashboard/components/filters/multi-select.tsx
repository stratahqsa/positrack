"use client";

import * as React from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Compact multi-select popover: a chip-button that opens a checkbox list.
 * Self-contained (no portal/positioning library) — used once per filter
 * dimension by FilterBar, and reusable by future report views' filter bars.
 */
export function MultiSelect({
  label,
  options,
  selected,
  onChange,
  optionLabel,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  /** Optional display-label override per option value (e.g. epicId -> epic summary). */
  optionLabel?: (value: string) => string;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  if (options.length === 0) return null;

  function toggleValue(v: string) {
    onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[12px] font-medium transition-colors",
          selected.length > 0
            ? "border-accent/40 bg-accent/12 text-accent"
            : "border-border bg-surface/60 text-muted hover:border-border-strong hover:text-fg",
        )}
      >
        {label}
        {selected.length > 0 ? (
          <span className="tabular rounded bg-accent/20 px-1 text-[10.5px] leading-4">
            {selected.length}
          </span>
        ) : null}
        <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <div
          role="listbox"
          aria-label={label}
          className="absolute left-0 top-[calc(100%+4px)] z-20 max-h-64 w-56 overflow-y-auto rounded-lg border border-border-strong bg-surface-2 p-1.5 shadow-xl scroll-slim"
        >
          {options.map((opt) => {
            const active = selected.includes(opt);
            return (
              <button
                key={opt}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => toggleValue(opt)}
                className={cn(
                  "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[12px] transition-colors",
                  active ? "bg-accent/12 text-fg" : "text-muted hover:bg-elevated hover:text-fg",
                )}
              >
                <span
                  className={cn(
                    "flex size-3.5 shrink-0 items-center justify-center rounded-sm border",
                    active ? "border-accent bg-accent text-bg" : "border-border-strong",
                  )}
                >
                  {active ? <Check className="size-2.5" /> : null}
                </span>
                <span className="truncate">{optionLabel ? optionLabel(opt) : opt}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
