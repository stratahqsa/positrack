import { describe, expect, it } from "vitest";
import { fmtDate, fmtHours, fmtMd, verdictVsQa } from "../lib/format";

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
