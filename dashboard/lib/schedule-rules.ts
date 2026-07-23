/**
 * Admin-managed refresh schedule: pure types + rules. The Vercel Cron tick
 * (app/api/cron/refresh) asks dueSlot() whether a configured IST slot falls in
 * this 15-min window; the admin panel edits and normalizeSchedule() validates.
 * Times are IST wall-clock ("HH:MM") — the team's shared meeting reference.
 * Pure module (no I/O, no React): imported by both server routes and the
 * client-side admin panel.
 */

export interface ScheduleConfig {
  enabled: boolean;
  days: Record<"mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun", boolean>;
  slots_ist: string[];
  /** "YYYY-MM-DD" (IST date), inclusive — refreshes resume the day after. */
  paused_until: string | null;
  updated_at?: string;
  updated_by?: string;
}

export const DEFAULT_SCHEDULE: ScheduleConfig = {
  enabled: true,
  days: { mon: true, tue: true, wed: true, thu: true, fri: true, sat: true, sun: true },
  slots_ist: ["08:00", "09:45", "12:00", "16:00", "19:00"],
  paused_until: null,
};

const IST_OFFSET_MIN = 330;
const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

/** IST wall-clock parts for a UTC instant (fixed +05:30, never the runner TZ). */
export function istParts(utcMs: number): {
  day: (typeof DAY_KEYS)[number];
  minutes: number;
  date: string;
} {
  const d = new Date(utcMs + IST_OFFSET_MIN * 60_000);
  return {
    day: DAY_KEYS[d.getUTCDay()],
    minutes: d.getUTCHours() * 60 + d.getUTCMinutes(),
    date: d.toISOString().slice(0, 10),
  };
}

/** "HH:MM" (24h) → minutes-since-midnight, or null if invalid. */
export function parseSlot(s: string): number | null {
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(s.trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/**
 * The slot due in [now, now+windowMin), or null. Slots very close to IST
 * midnight interact with the day mask of the day they START in — keep slots
 * inside working hours (the panel's use case) and this never matters.
 */
export function dueSlot(cfg: ScheduleConfig, nowUtcMs: number, windowMin = 15): string | null {
  if (!cfg.enabled) return null;
  const p = istParts(nowUtcMs);
  if (cfg.paused_until && p.date <= cfg.paused_until) return null;
  if (!cfg.days[p.day]) return null;
  for (const s of cfg.slots_ist) {
    const m = parseSlot(s);
    if (m !== null && m >= p.minutes && m < p.minutes + windowMin) return s;
  }
  return null;
}

/** Validate + canonicalize untrusted input into a ScheduleConfig (null = reject). */
export function normalizeSchedule(input: unknown): ScheduleConfig | null {
  if (typeof input !== "object" || input === null) return null;
  const o = input as Record<string, unknown>;
  const days = { ...DEFAULT_SCHEDULE.days };
  if (typeof o.days === "object" && o.days !== null) {
    for (const k of Object.keys(days) as (keyof ScheduleConfig["days"])[]) {
      const v = (o.days as Record<string, unknown>)[k];
      if (typeof v === "boolean") days[k] = v;
    }
  }
  const raw = Array.isArray(o.slots_ist) ? o.slots_ist : DEFAULT_SCHEDULE.slots_ist;
  const canon = raw
    .filter((s): s is string => typeof s === "string" && parseSlot(s) !== null)
    .map((s) => {
      const m = parseSlot(s)!;
      return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
    });
  const slots = [...new Set(canon)].sort((a, b) => parseSlot(a)! - parseSlot(b)!);
  if (slots.length === 0 || slots.length > 24) return null;
  const paused =
    typeof o.paused_until === "string" && /^\d{4}-\d{2}-\d{2}$/.test(o.paused_until)
      ? o.paused_until
      : null;
  return { enabled: o.enabled !== false, days, slots_ist: slots, paused_until: paused };
}
