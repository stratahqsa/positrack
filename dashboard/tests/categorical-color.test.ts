import { describe, expect, it } from "vitest";
import { categoricalVariant } from "../lib/categorical-color";

describe("categoricalVariant", () => {
  it("is deterministic — same string always gets the same variant", () => {
    expect(categoricalVariant("Escalated")).toBe(categoricalVariant("Escalated"));
    expect(categoricalVariant("SA")).toBe(categoricalVariant("SA"));
  });

  it("never returns the flat neutral variants (the whole point is differentiation)", () => {
    const values = ["New", "On hold", "Escalated", "X Dev Ticket Created", "SA", "UAE", "KSA", ""];
    for (const v of values) {
      const variant = categoricalVariant(v);
      expect(variant).not.toBe("default");
      expect(variant).not.toBe("outline");
    }
  });

  it("assigns different colors to at least some distinct SUP states (not everything collapsing to one bucket)", () => {
    const states = ["New", "On hold", "Escalated", "X Dev Ticket Created"];
    const variants = new Set(states.map(categoricalVariant));
    expect(variants.size).toBeGreaterThan(1);
  });
});
