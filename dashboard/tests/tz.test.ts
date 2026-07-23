import { describe, expect, it } from "vitest";
import { IST, SAST, isValidTimeZone, resolveTz } from "../lib/tz";

describe("resolveTz", () => {
  it("explicit pref wins", () => {
    expect(resolveTz(SAST, "Asia/Dubai")).toBe(SAST);
    expect(resolveTz(IST, undefined)).toBe(IST);
  });

  it("auto uses detected when valid", () => {
    expect(resolveTz("auto", "Asia/Dubai")).toBe("Asia/Dubai");
    expect(resolveTz(undefined, "Asia/Dubai")).toBe("Asia/Dubai");
  });

  it("falls back to IST on junk", () => {
    expect(resolveTz("auto", "Not/AZone")).toBe(IST);
    expect(resolveTz(undefined, undefined)).toBe(IST);
    expect(resolveTz("<script>", undefined)).toBe(IST);
  });
});

describe("isValidTimeZone", () => {
  it("accepts real zones, rejects junk", () => {
    expect(isValidTimeZone("Asia/Dubai")).toBe(true);
    expect(isValidTimeZone("Not/AZone")).toBe(false);
  });
});
