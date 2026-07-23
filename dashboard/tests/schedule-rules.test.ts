import { describe, expect, it } from "vitest";
import {
  DEFAULT_SCHEDULE,
  dueSlot,
  istParts,
  normalizeSchedule,
  parseSlot,
} from "../lib/schedule-rules";

// 2026-07-23 02:30:00 UTC == 08:00 IST (Thursday)
const T_0800_IST = Date.UTC(2026, 6, 23, 2, 30, 0);

describe("istParts", () => {
  it("converts UTC to IST wall-clock", () => {
    const p = istParts(T_0800_IST);
    expect(p).toEqual({ day: "thu", minutes: 8 * 60, date: "2026-07-23" });
  });

  it("rolls the IST date past UTC midnight", () => {
    // 20:00 UTC Jul 23 == 01:30 IST Jul 24 (Friday)
    const p = istParts(Date.UTC(2026, 6, 23, 20, 0, 0));
    expect(p).toEqual({ day: "fri", minutes: 90, date: "2026-07-24" });
  });
});

describe("parseSlot", () => {
  it("accepts HH:MM and rejects junk", () => {
    expect(parseSlot("09:45")).toBe(585);
    expect(parseSlot("8:00")).toBe(480);
    expect(parseSlot("23:59")).toBe(1439);
    expect(parseSlot("24:00")).toBeNull();
    expect(parseSlot("8:5")).toBeNull();
    expect(parseSlot("nope")).toBeNull();
  });
});

describe("dueSlot", () => {
  it("fires a slot inside [tick, tick+15)", () => {
    expect(dueSlot(DEFAULT_SCHEDULE, T_0800_IST)).toBe("08:00");
    expect(dueSlot(DEFAULT_SCHEDULE, T_0800_IST - 15 * 60_000)).toBeNull(); // 07:45 tick
    expect(dueSlot(DEFAULT_SCHEDULE, T_0800_IST + 105 * 60_000)).toBe("09:45");
  });

  it("respects enabled / day mask / pause", () => {
    expect(dueSlot({ ...DEFAULT_SCHEDULE, enabled: false }, T_0800_IST)).toBeNull();
    expect(
      dueSlot(
        { ...DEFAULT_SCHEDULE, days: { ...DEFAULT_SCHEDULE.days, thu: false } },
        T_0800_IST,
      ),
    ).toBeNull();
    expect(dueSlot({ ...DEFAULT_SCHEDULE, paused_until: "2026-07-23" }, T_0800_IST)).toBeNull();
    expect(dueSlot({ ...DEFAULT_SCHEDULE, paused_until: "2026-07-22" }, T_0800_IST)).toBe("08:00");
  });
});

describe("normalizeSchedule", () => {
  it("sorts + dedupes + zero-pads slots, drops invalid", () => {
    const cfg = normalizeSchedule({ slots_ist: ["9:45", "08:00", "09:45", "bad"] });
    expect(cfg?.slots_ist).toEqual(["08:00", "09:45"]);
  });

  it("rejects empty slot lists and non-objects", () => {
    expect(normalizeSchedule({ slots_ist: [] })).toBeNull();
    expect(normalizeSchedule("x")).toBeNull();
    expect(normalizeSchedule(null)).toBeNull();
  });

  it("defaults days/enabled and validates paused_until", () => {
    const cfg = normalizeSchedule({ slots_ist: ["08:00"], paused_until: "not-a-date" });
    expect(cfg?.enabled).toBe(true);
    expect(cfg?.days.sun).toBe(true);
    expect(cfg?.paused_until).toBeNull();
    const cfg2 = normalizeSchedule({
      slots_ist: ["08:00"],
      enabled: false,
      days: { sun: false },
      paused_until: "2026-08-01",
    });
    expect(cfg2?.enabled).toBe(false);
    expect(cfg2?.days.sun).toBe(false);
    expect(cfg2?.days.mon).toBe(true);
    expect(cfg2?.paused_until).toBe("2026-08-01");
  });
});
