import { describe, expect, it } from "vitest";
import { fmtDate, fmtDateTime, fmtDateTimeIst, fmtHours, fmtMd, fmtTimeShort, tzLabel, verdictVsQa } from "../lib/format";

/**
 * Display/format helpers. Cases lifted from docs/reports-dashboard/reference/specs/
 * Examples_4_Weekly_Deadline_View_Implementation_Guide.md §9 (calculations + the
 * early/late verdict table) and §4 (ddTs -> ddDisp worked example).
 */

describe("fmtHours", () => {
  it("1440 min -> 24.0h", () => {
    expect(fmtHours(1440)).toBe("24.0h");
  });

  it("0 -> em dash", () => {
    expect(fmtHours(0)).toBe("—");
  });

  it("matches the §9 worked totals (UI 480 -> 8.0h, Total 2400 -> 40.0h, Spent 1410 -> 23.5h)", () => {
    expect(fmtHours(480)).toBe("8.0h");
    expect(fmtHours(2400)).toBe("40.0h");
    expect(fmtHours(1410)).toBe("23.5h");
  });
});

describe("fmtMd", () => {
  it("1440 min -> 3.0md", () => {
    expect(fmtMd(1440)).toBe("3.0md");
  });

  it("480 min (one man-day) -> 1.0md", () => {
    expect(fmtMd(480)).toBe("1.0md");
  });

  it("0 -> em dash", () => {
    expect(fmtMd(0)).toBe("—");
  });

  it("matches the §9 worked total (2400 -> 5.0md)", () => {
    expect(fmtMd(2400)).toBe("5.0md");
  });
});

describe("fmtDate", () => {
  it("epoch ms -> 'DD Mon' (Examples_4 §4: ddTs 1751932800000 -> ddDisp 08 Jul)", () => {
    expect(fmtDate(1751932800000)).toBe("08 Jul");
  });

  it("null -> em dash", () => {
    expect(fmtDate(null)).toBe("—");
  });

  it("a June date renders with the correct month abbreviation", () => {
    expect(fmtDate(Date.UTC(2026, 5, 30))).toBe("30 Jun");
  });
});

describe("fmtDateTimeIst", () => {
  // Examples_1_PXB1_Bug_Analysis_Implementation_Guide.md §4/§18 gives
  // 1751971500000 -> "08 Jul 2026, 4:15 PM" as the worked example. Independent
  // verification (fixed UTC+5:30 offset, cross-checked against Node's Date
  // and against a real bug `created` value from dashboard/data/latest.json —
  // see below) shows that ms value is actually 08 Jul *2025*, 4:15 PM IST:
  // day/month/hour/minute match the doc exactly, only the year is off by
  // one — consistent with a stale fixture left over from when the doc's
  // fictional "today" was mid-2025, before the project's snapshot data moved
  // to 2026. Asserting the mathematically-correct value (flagged to the
  // orchestrator rather than silently building broken +5:30 math that would
  // also mis-render every real 2026 timestamp in the live snapshot).
  it("epoch ms -> 'DD Mon YYYY, h:mm AM/PM' in IST (Examples_1 §4 constant, year-corrected — see comment above)", () => {
    expect(fmtDateTimeIst(1751971500000)).toBe("08 Jul 2025, 4:15 PM");
  });

  it("a real 2026 bug `created` timestamp from the live snapshot renders the correct year", () => {
    expect(fmtDateTimeIst(1783941449646)).toBe("13 Jul 2026, 4:47 PM");
  });

  it("null -> em dash", () => {
    expect(fmtDateTimeIst(null)).toBe("—");
  });

  it("midnight IST -> '12:00 AM' (not '0:00 AM')", () => {
    const ms = Date.UTC(2026, 6, 10, 0, 0) - 5.5 * 60 * 60 * 1000;
    expect(fmtDateTimeIst(ms)).toBe("10 Jul 2026, 12:00 AM");
  });

  it("noon IST -> '12:00 PM' (not '0:00 PM')", () => {
    const ms = Date.UTC(2026, 6, 10, 12, 0) - 5.5 * 60 * 60 * 1000;
    expect(fmtDateTimeIst(ms)).toBe("10 Jul 2026, 12:00 PM");
  });

  it("minutes are always zero-padded to two digits", () => {
    const ms = Date.UTC(2026, 6, 10, 9, 5) - 5.5 * 60 * 60 * 1000;
    expect(fmtDateTimeIst(ms)).toBe("10 Jul 2026, 9:05 AM");
  });
});

describe("verdictVsQa", () => {
  it("resolved 08 Jul vs qa 06 Jul -> +2d late (Examples_4 §11 T12)", () => {
    const resolved = Date.UTC(2026, 6, 8);
    const qa = Date.UTC(2026, 6, 6);
    expect(verdictVsQa(resolved, qa)).toEqual({ label: "+2d late", late: true });
  });

  it("resolved 04 Jul vs qa 06 Jul -> 2d early", () => {
    const resolved = Date.UTC(2026, 6, 4);
    const qa = Date.UTC(2026, 6, 6);
    expect(verdictVsQa(resolved, qa)).toEqual({ label: "2d early", late: false });
  });

  it("exactly equal timestamps -> not late (Examples_4 §12: equal timestamps = not late)", () => {
    const ts = Date.UTC(2026, 6, 6);
    expect(verdictVsQa(ts, ts)).toEqual({ label: "0d early", late: false });
  });

  it("same calendar day but resolved after qa -> still late, +0d late (Examples_4 §9 row 3, strictly resolved > qaTs)", () => {
    const resolved = Date.UTC(2026, 6, 6, 9, 0, 0);
    const qa = Date.UTC(2026, 6, 6, 0, 0, 0);
    expect(verdictVsQa(resolved, qa)).toEqual({ label: "+0d late", late: true });
  });

  it("rounds 2.75 days up to +3d late (Examples_4 §9 row 2)", () => {
    const resolved = Date.UTC(2026, 6, 8, 18, 0, 0);
    const qa = Date.UTC(2026, 6, 6, 0, 0, 0);
    expect(verdictVsQa(resolved, qa)).toEqual({ label: "+3d late", late: true });
  });

  it("null resolved (unresolved/pending) -> null", () => {
    expect(verdictVsQa(null, Date.UTC(2026, 6, 6))).toBeNull();
  });

  it("null qa deadline -> null (no deadline to compare against)", () => {
    expect(verdictVsQa(Date.UTC(2026, 6, 6), null)).toBeNull();
  });
});

describe("fmtDateTime (tz-aware)", () => {
  it("matches fmtDateTimeIst exactly for IST", () => {
    for (const ms of [1751971500000, 1783941449646, 1783953000000]) {
      expect(fmtDateTime(ms, "Asia/Kolkata")).toBe(fmtDateTimeIst(ms));
    }
  });

  it("renders SAST 3.5h behind IST", () => {
    // 1783941449646 = 13 Jul 2026, 4:47 PM IST -> 1:17 PM SAST
    expect(fmtDateTime(1783941449646, "Africa/Johannesburg")).toBe("13 Jul 2026, 1:17 PM");
  });

  it("null -> em dash", () => {
    expect(fmtDateTime(null, "Asia/Kolkata")).toBe("—");
  });
});

describe("fmtTimeShort / tzLabel", () => {
  it("HH:mm in the target zone", () => {
    expect(fmtTimeShort(1783941449646, "Asia/Kolkata")).toBe("16:47");
    expect(fmtTimeShort(null, "Asia/Kolkata")).toBe("—");
  });

  it("labels the team zones, falls back to short name", () => {
    expect(tzLabel("Asia/Kolkata")).toBe("IST");
    expect(tzLabel("Africa/Johannesburg")).toBe("SAST");
    expect(typeof tzLabel("Asia/Dubai")).toBe("string");
  });
});
