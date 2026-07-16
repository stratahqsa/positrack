import type { ComponentType } from "react";
import { AlertOctagon, AlertTriangle, CheckCircle2 } from "lucide-react";
import type { Severity } from "@/lib/types";

export interface SeverityContent {
  /** Screen-reader / tooltip label, e.g. "High severity". */
  label: string;
  icon: ComponentType<{ className?: string }>;
  /** Icon/heading text color utility. */
  text: string;
  /** Flat tint for swatches/banners. */
  bg: string;
  /** Ring color for swatches/banners. */
  ring: string;
  /** Gradient "from" stop for an ambient wash, same idiom as
   *  components/health/on-track-banner.tsx's `glow`. */
  glow: string;
  /** Left-rail accent border for a list item. */
  rail: string;
  /** Variant name for the shared `Badge` component. */
  badge: "danger" | "warn" | "good";
}

/**
 * Severity → color/icon treatment, shared by components/insights/briefing.tsx
 * (per-item icon + left rail + top-finding banner) and brief-teaser.tsx
 * (Health teaser accent) so the two surfaces never disagree about what
 * "high" looks like. Same {icon,text,bg,ring,glow} shape as
 * components/health/on-track-banner.tsx's `CONTENT` map — reusing that
 * design language rather than inventing a new one: danger=red=high,
 * warn=amber=medium, good=green=low.
 */
export const SEVERITY_CONTENT: Record<Severity, SeverityContent> = {
  high: {
    label: "High severity",
    icon: AlertOctagon,
    text: "text-danger",
    bg: "bg-danger/[0.08]",
    ring: "ring-danger/25",
    glow: "from-danger/10",
    rail: "border-l-danger/50",
    badge: "danger",
  },
  medium: {
    label: "Medium severity",
    icon: AlertTriangle,
    text: "text-warn",
    bg: "bg-warn/[0.08]",
    ring: "ring-warn/25",
    glow: "from-warn/10",
    rail: "border-l-warn/50",
    badge: "warn",
  },
  low: {
    label: "Low severity",
    icon: CheckCircle2,
    text: "text-good",
    bg: "bg-good/[0.08]",
    ring: "ring-good/25",
    glow: "from-good/10",
    rail: "border-l-good/50",
    badge: "good",
  },
};
