import { describe, expect, it } from "vitest";
import { supStateVariant } from "../components/support/sup-state-tone";
import { categoricalVariant } from "../lib/categorical-color";

describe("supStateVariant", () => {
  it("PM-confirmed priority tiers (2026-08-08)", () => {
    expect(supStateVariant("Escalated")).toBe("danger"); // top priority
    expect(supStateVariant("New")).toBe("warn"); // medium priority
    expect(supStateVariant("On hold")).toBe("warn"); // medium priority
    expect(supStateVariant("X Dev Ticket Created")).toBe("good"); // low priority / positive
  });

  it("is case-insensitive", () => {
    expect(supStateVariant("escalated")).toBe("danger");
    expect(supStateVariant("ESCALATED")).toBe("danger");
  });

  it("falls back to categoricalVariant for unrecognized states, never a flat gray default", () => {
    const variant = supStateVariant("Waiting On Customer");
    expect(variant).toBe(categoricalVariant("Waiting On Customer"));
    expect(variant).not.toBe("default");
    expect(variant).not.toBe("outline");
  });
});
