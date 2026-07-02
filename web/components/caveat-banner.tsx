import * as React from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "info" | "warn" | "violet";

const TONE: Record<Tone, string> = {
  info: "border-info/25 bg-info/[0.06] text-info",
  warn: "border-warn/25 bg-warn/[0.06] text-warn",
  violet: "border-violet/25 bg-violet/[0.06] text-violet",
};

/** Prominent, honest caveat banner used above person/team/leaderboard views. */
export function CaveatBanner({
  tone = "info",
  title,
  children,
}: {
  tone?: Tone;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5",
        TONE[tone],
      )}
      role="note"
    >
      <Info className="mt-0.5 size-4 shrink-0" />
      <div className="text-[12px] leading-relaxed">
        <span className="font-semibold">{title}</span>
        {children ? <span className="text-fg/75"> — {children}</span> : null}
      </div>
    </div>
  );
}
