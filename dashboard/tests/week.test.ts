import { describe, expect, it } from "vitest";
import { currentWeek, isThisWeek, weekIndexOf } from "../lib/week";

/**
 * Release-week model: Tue→Mon weeks, week 1 starting at `config.week1_anchor`.
 * Cases lifted from docs/reports-dashboard/reference/specs/
 * Examples_4_Weekly_Deadline_View_Implementation_Guide.md §7 (anchor 2026-06-30).
 * Day boundaries are computed in UTC (see lib/week.ts for why).
 */

const ANCHOR = Date.UTC(2026, 5, 30); // 30 Jun 2026 (month is 0-based)

describe("weekIndexOf", () => {
  it("the anchor day itself is week index 0", () => {
    expect(weekIndexOf(ANCHOR, ANCHOR)).toBe(0);
  });

  it("folds deadlines before the anchor into week 1 (index 0)", () => {
    expect(weekIndexOf(Date.UTC(2026, 5, 12), ANCHOR)).toBe(0); // 12 Jun 2026
  });

  it("06 Jul 2026 (last day of week 1) is index 0", () => {
    expect(weekIndexOf(Date.UTC(2026, 6, 6), ANCHOR)).toBe(0);
  });

  it("07 Jul 2026 (first day of week 2) is index 1", () => {
    expect(weekIndexOf(Date.UTC(2026, 6, 7), ANCHOR)).toBe(1);
  });

  it("08 Jul 2026 is index 1 (Examples_4 §7 example 3)", () => {
    expect(weekIndexOf(Date.UTC(2026, 6, 8), ANCHOR)).toBe(1);
  });

  it("13 Jul 2026 (last day of week 2) is index 1", () => {
    expect(weekIndexOf(Date.UTC(2026, 6, 13), ANCHOR)).toBe(1);
  });

  it("14 Jul 2026 (first day of week 3) is index 2", () => {
    expect(weekIndexOf(Date.UTC(2026, 6, 14), ANCHOR)).toBe(2);
  });

  it("truncates to the UTC calendar day, ignoring time-of-day", () => {
    // 23:59:59.999 on 13 Jul is still 13 Jul -> week index 1, not 2.
    const lateInDay = Date.UTC(2026, 6, 13, 23, 59, 59, 999);
    expect(weekIndexOf(lateInDay, ANCHOR)).toBe(1);
  });
});

describe("currentWeek", () => {
  it("9 Jul 2026 -> current week is Week 2 (07-13 Jul), index 1", () => {
    const now = Date.UTC(2026, 6, 9);
    const week = currentWeek(now, ANCHOR);
    expect(week.index).toBe(1);
    expect(week.startMs).toBe(Date.UTC(2026, 6, 7));
    expect(week.endMs).toBe(Date.UTC(2026, 6, 14) - 1);
  });

  it("14 Jul 2026 -> current week is Week 3 (14-20 Jul), index 2", () => {
    const now = Date.UTC(2026, 6, 14);
    const week = currentWeek(now, ANCHOR);
    expect(week.index).toBe(2);
    expect(week.startMs).toBe(Date.UTC(2026, 6, 14));
    expect(week.endMs).toBe(Date.UTC(2026, 6, 21) - 1);
  });

  it("clamps to week 1 (index 0) when run before the anchor", () => {
    const now = Date.UTC(2026, 5, 1); // 1 Jun 2026, before the 30 Jun anchor
    expect(currentWeek(now, ANCHOR).index).toBe(0);
  });
});

describe("isThisWeek", () => {
  it("08 Jul 2026 is NOT this week when today is 14 Jul 2026", () => {
    const now = Date.UTC(2026, 6, 14);
    const dd = Date.UTC(2026, 6, 8);
    expect(isThisWeek(dd, now, ANCHOR)).toBe(false);
  });

  it("15 Jul 2026 IS this week when today is 14 Jul 2026", () => {
    const now = Date.UTC(2026, 6, 14);
    const dd = Date.UTC(2026, 6, 15);
    expect(isThisWeek(dd, now, ANCHOR)).toBe(true);
  });

  it("an early (pre-anchor) deadline counts as this week only while week 1 is current", () => {
    const dd = Date.UTC(2026, 5, 12); // 12 Jun 2026, folds to week 1
    expect(isThisWeek(dd, ANCHOR, ANCHOR)).toBe(true); // today = anchor -> current week is week 1
    expect(isThisWeek(dd, Date.UTC(2026, 6, 14), ANCHOR)).toBe(false); // today = 14 Jul -> current week is week 3
  });
});
