import { CheckCircle2, AlertTriangle, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

type Status = "on-track" | "at-risk" | "behind";

const CONTENT: Record<
  Status,
  {
    label: string;
    icon: typeof CheckCircle2;
    ring: string;
    bg: string;
    text: string;
    glow: string;
  }
> = {
  "on-track": {
    label: "On track",
    icon: CheckCircle2,
    ring: "ring-good/30",
    bg: "bg-good/[0.08]",
    text: "text-good",
    glow: "from-good/10",
  },
  "at-risk": {
    label: "At risk",
    icon: AlertTriangle,
    ring: "ring-warn/30",
    bg: "bg-warn/[0.08]",
    text: "text-warn",
    glow: "from-warn/10",
  },
  behind: {
    label: "Behind",
    icon: ShieldAlert,
    ring: "ring-danger/30",
    bg: "bg-danger/[0.08]",
    text: "text-danger",
    glow: "from-danger/10",
  },
};

/**
 * The landing view's headline: onTrackVerdict()'s status + reasons, color
 * coded green/amber/red. Prominent by design — this is the one number every
 * viewer should see first.
 */
export function OnTrackBanner({
  status,
  reasons,
}: {
  status: Status;
  reasons: string[];
}) {
  const c = CONTENT[status];
  const Icon = c.icon;
  return (
    <section
      aria-label="Project status"
      className={cn(
        "relative overflow-hidden rounded-xl p-5 ring-1 backdrop-blur-sm",
        c.ring,
        c.bg,
        status === "behind" && "pulse-danger",
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-0 bg-gradient-to-br to-transparent opacity-70",
          c.glow,
        )}
      />
      <div className="relative flex items-start gap-3.5">
        <div
          className={cn(
            "mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full ring-1",
            c.ring,
            c.bg,
          )}
        >
          <Icon className={cn("size-5", c.text)} />
        </div>
        <div className="min-w-0">
          <span
            className={cn(
              "text-[11px] font-semibold uppercase tracking-wide",
              c.text,
            )}
          >
            Project status
          </span>
          <h2 className={cn("mt-0.5 text-xl font-bold tracking-tight", c.text)}>
            {c.label}
          </h2>
          <ul className="mt-2 flex flex-col gap-1 text-[13px] leading-relaxed text-fg/85">
            {reasons.map((r) => (
              <li key={r} className="flex items-start gap-1.5">
                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-current opacity-60" />
                {r}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
