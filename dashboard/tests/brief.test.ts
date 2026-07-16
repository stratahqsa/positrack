import { describe, expect, it } from "vitest";
import { briefAgeMs, formatBriefAge, getBrief, isBriefOk, rehydrateBrief } from "../lib/brief";
import type { AiBrief } from "../lib/types";
import { baseSnapshot, baseStory } from "./fixtures";

/**
 * lib/brief.ts is a thin, pure read layer over Snapshot.ai_brief (see
 * lib/types.ts for the contract) — no I/O, so every case here is a direct
 * function call, same style as tests/health.test.ts. Covers the scenarios
 * the two rendering surfaces (components/insights/briefing.tsx and
 * components/insights/brief-teaser.tsx) branch on:
 *  - getBrief: presence/absence, and that a 3-section brief round-trips with
 *    every item + evidence_ref intact (the data shape briefing.tsx's 3
 *    section cards map over 1:1 — see its own "ok" branch).
 *  - isBriefOk: the single ok/empty/unavailable gate BOTH surfaces read, so
 *    "teaser hidden when not ok" and briefing.tsx's unavailable-state branch
 *    are really the same predicate under test here.
 *  - briefAgeMs/formatBriefAge: the age-at-render math that replaced the
 *    tautological brief-vs-meta comparison (consensus plan M1) — nowMs is
 *    always passed explicitly (a stand-in for a mocked Date.now()), never
 *    read from any snapshot field.
 */

const GENERATED_AT = Date.UTC(2026, 6, 16, 8, 0, 0); // 16 Jul 2026 08:00 UTC

function sampleBrief(overrides: Partial<AiBrief> = {}): AiBrief {
  return {
    status: "ok",
    generated_at: GENERATED_AT,
    model_id: "deepseek/deepseek-chat",
    top_finding: "3 stories are overdue past QA deadline, led by Shafeek M.",
    empty: false,
    sections: [
      {
        title: "Top issues now",
        items: [
          { text: "PXB1-7206 is overdue past its QA deadline.", evidence_ref: "PXB1-7206" },
          { text: "Product module has the most 7-day bug volume.", evidence_ref: "bugs.module_insights[0]" },
        ],
      },
      {
        title: "Since yesterday",
        items: [{ text: "Total RED count rose by 2.", evidence_ref: "insights.red_delta.total_red" }],
      },
      {
        title: "Most behind",
        items: [{ text: "Shafeek M has 1 overdue story.", evidence_ref: "accountability.byPerson[0]" }],
      },
    ],
    ...overrides,
  };
}

describe("getBrief", () => {
  it("returns snapshot.ai_brief when present, with all 3 sections and evidence refs intact", () => {
    const s = baseSnapshot();
    s.ai_brief = sampleBrief();

    const brief = getBrief(s);

    expect(brief).not.toBeNull();
    expect(brief!.sections).toHaveLength(3);
    expect(brief!.sections.map((sec) => sec.title)).toEqual([
      "Top issues now",
      "Since yesterday",
      "Most behind",
    ]);
    expect(brief!.sections[0].items[0]).toEqual({
      text: "PXB1-7206 is overdue past its QA deadline.",
      evidence_ref: "PXB1-7206",
    });
  });

  it("returns null when the snapshot predates the AI briefing feature (ai_brief absent)", () => {
    const s = baseSnapshot();
    expect(getBrief(s)).toBeNull();
  });
});

describe("isBriefOk", () => {
  it("is true when the brief is present and status is ok", () => {
    expect(isBriefOk(sampleBrief())).toBe(true);
  });

  it("is false when ai_brief is absent (null) — teaser and briefing both render nothing/unavailable", () => {
    expect(isBriefOk(null)).toBe(false);
  });

  it("is false when status is unavailable, even with a reason present", () => {
    const brief = sampleBrief({
      status: "unavailable",
      reason: "validator rejected an evidence_ref",
      sections: [],
    });
    expect(isBriefOk(brief)).toBe(false);
  });

  it("is true for an empty (all-green) brief — empty is a content state, not an availability state", () => {
    const brief = sampleBrief({ empty: true, sections: [], top_finding: "Nothing notable this cycle." });
    expect(isBriefOk(brief)).toBe(true);
  });
});

describe("briefAgeMs", () => {
  it("is wall-clock nowMs minus brief.generated_at", () => {
    const brief = sampleBrief();
    expect(briefAgeMs(brief, GENERATED_AT + 42 * 60_000)).toBe(42 * 60_000);
  });

  it("is zero when rendered at the exact moment of generation (mocked clock == generated_at)", () => {
    const brief = sampleBrief();
    expect(briefAgeMs(brief, GENERATED_AT)).toBe(0);
  });

  it("depends only on the passed nowMs, not on any snapshot/meta field — grows as a mocked clock advances", () => {
    const brief = sampleBrief();
    const oneHourLater = GENERATED_AT + 60 * 60_000;
    const twoHoursLater = GENERATED_AT + 2 * 60 * 60_000;
    expect(briefAgeMs(brief, twoHoursLater)).toBeGreaterThan(briefAgeMs(brief, oneHourLater));
    expect(briefAgeMs(brief, twoHoursLater)).toBe(2 * briefAgeMs(brief, oneHourLater));
  });
});

describe("formatBriefAge", () => {
  it("under 1 minute -> 'just now'", () => {
    expect(formatBriefAge(0)).toBe("just now");
    expect(formatBriefAge(20_000)).toBe("just now");
  });

  it("whole minutes under an hour -> 'N min ago'", () => {
    expect(formatBriefAge(42 * 60_000)).toBe("42 min ago");
  });

  it("rounds up into hours at the 60-minute boundary", () => {
    expect(formatBriefAge(59 * 60_000 + 40_000)).toBe("1 hr ago");
  });

  it("whole hours under a day, pluralized", () => {
    expect(formatBriefAge(90 * 60_000)).toBe("2 hrs ago");
  });

  it("singular hour has no trailing s", () => {
    expect(formatBriefAge(60 * 60_000)).toBe("1 hr ago");
  });

  it("days beyond 24 hours, pluralized", () => {
    expect(formatBriefAge(48 * 60 * 60_000)).toBe("2 days ago");
  });

  it("clamps a negative age (clock skew) to 'just now' instead of a negative count", () => {
    expect(formatBriefAge(-5_000)).toBe("just now");
  });
});

describe("rehydrateBrief", () => {
  // Build a snapshot whose accountability(byPerson) ranking is deterministic:
  // Alice (2 overdue) ranks above Bob (0 overdue), so P1->Alice, P2->Bob —
  // exactly the rank order the upstream pseudonymizer minted the tokens against.
  function snapshotWithRanking(): ReturnType<typeof baseSnapshot> {
    const s = baseSnapshot();
    s.meta.generated_at_ms = GENERATED_AT;
    s.schedule = {
      epics: [],
      orphan_count: 0,
      stories: [
        baseStory({ storyId: "S1", assignee: "Alice", done: false, qaTs: GENERATED_AT - 60_000 }),
        baseStory({ storyId: "S2", assignee: "Alice", done: false, qaTs: GENERATED_AT - 60_000 }),
        baseStory({ storyId: "S3", assignee: "Bob", done: false, qaTs: GENERATED_AT + 60_000 }),
      ],
    };
    return s;
  }

  it("replaces P1/P2 tokens with real names (in accountability rank order) across text, top_finding, and source.label", () => {
    const s = snapshotWithRanking();
    const brief = sampleBrief({
      top_finding: "P1 is the furthest behind.",
      sections: [
        {
          title: "Most behind",
          items: [
            { text: "P1 has 2 late stories.", evidence_ref: "person-1", source: { label: "P1", href: "/weekly" } },
            { text: "P2 has 1 open story.", evidence_ref: "person-2", source: { label: "P2", href: "/weekly" } },
          ],
        },
      ],
    });

    const out = rehydrateBrief(brief, s);

    expect(out.top_finding).toBe("Alice is the furthest behind.");
    expect(out.sections[0].items[0].text).toBe("Alice has 2 late stories.");
    expect(out.sections[0].items[0].source!.label).toBe("Alice");
    expect(out.sections[0].items[1].text).toBe("Bob has 1 open story.");
    expect(out.sections[0].items[1].source!.label).toBe("Bob");
  });

  it("word-bounds the replace so 'P1' never matches inside 'P10'/'P11'", () => {
    const s = snapshotWithRanking();
    const brief = sampleBrief({
      top_finding: "P10 is a ticket id, not a person.",
      sections: [{ title: "x", items: [{ text: "P10 is unrelated.", evidence_ref: "person-1" }] }],
    });
    expect(rehydrateBrief(brief, s).top_finding).toBe("P10 is a ticket id, not a person.");
  });

  it("leaves a brief with no pseudonym tokens unchanged", () => {
    const s = snapshotWithRanking();
    const brief = sampleBrief({ top_finding: "All modules look fine.", empty: true, sections: [] });
    expect(rehydrateBrief(brief, s)).toEqual(brief);
  });
});
