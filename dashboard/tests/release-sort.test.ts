import { describe, expect, it } from "vitest";
import { nextSort, sortEpics, sortStories } from "../lib/release-sort";
import type { EpicView } from "../lib/release";
import { baseStory } from "./fixtures";

function epic(over: Partial<EpicView>): EpicView {
  return {
    id: "PXB1-1", summary: "s", assignee: "", isNew: false, badge: "NOT_DONE", done: false,
    stories: [], visibleStories: [], rollup: { dev: 0, ui: 0, qa: 0, spent: 0 },
    maxDevDeadlineMs: null, maxQaDeadlineMs: null, milestoneMs: null, resolvedMs: null, resolvedVerdict: null,
    ...over,
  };
}

describe("nextSort", () => {
  it("cycles asc -> desc -> default for the same column", () => {
    const a = nextSort(null, "spent");
    expect(a).toEqual({ key: "spent", dir: "asc" });
    const d = nextSort(a, "spent");
    expect(d).toEqual({ key: "spent", dir: "desc" });
    expect(nextSort(d, "spent")).toBeNull();
  });
  it("a different column starts ascending", () => {
    expect(nextSort({ key: "spent", dir: "desc" }, "assignee")).toEqual({ key: "assignee", dir: "asc" });
  });
});

describe("sortEpics", () => {
  const e1 = epic({ id: "PXB1-9", summary: "beta", assignee: "Zed", rollup: { dev: 10, ui: 0, qa: 0, spent: 5 }, maxQaDeadlineMs: 300 });
  const e2 = epic({ id: "PXB1-10171", summary: "Alpha", assignee: "Amy", rollup: { dev: 30, ui: 0, qa: 10, spent: 1 }, maxQaDeadlineMs: null });
  const e3 = epic({ id: "PXB1-100", summary: "gamma", assignee: "", rollup: { dev: 20, ui: 5, qa: 0, spent: 9 }, maxQaDeadlineMs: 100 });

  it("null sort leaves the default order untouched", () => {
    const list = [e1, e2, e3];
    expect(sortEpics(list, null)).toBe(list);
  });
  it("ticket sorts numerically, not alphabetically", () => {
    expect(sortEpics([e1, e2, e3], { key: "ticket", dir: "asc" }).map((e) => e.id)).toEqual(["PXB1-9", "PXB1-100", "PXB1-10171"]);
  });
  it("description is case-insensitive", () => {
    expect(sortEpics([e1, e2, e3], { key: "description", dir: "asc" }).map((e) => e.summary)).toEqual(["Alpha", "beta", "gamma"]);
  });
  it("total estimate is dev + ui + qa", () => {
    expect(sortEpics([e1, e2, e3], { key: "totalEst", dir: "desc" }).map((e) => e.id)).toEqual(["PXB1-10171", "PXB1-100", "PXB1-9"]);
  });
  it("blank values sort last in BOTH directions", () => {
    expect(sortEpics([e1, e2, e3], { key: "maxQaDl", dir: "asc" }).map((e) => e.id)).toEqual(["PXB1-100", "PXB1-9", "PXB1-10171"]);
    expect(sortEpics([e1, e2, e3], { key: "maxQaDl", dir: "desc" }).map((e) => e.id)).toEqual(["PXB1-9", "PXB1-100", "PXB1-10171"]);
    expect(sortEpics([e1, e2, e3], { key: "assignee", dir: "asc" }).map((e) => e.id)).toEqual(["PXB1-10171", "PXB1-9", "PXB1-100"]);
  });
  it("is stable for equal values", () => {
    const a = epic({ id: "PXB1-1", rollup: { dev: 5, ui: 0, qa: 0, spent: 0 } });
    const b = epic({ id: "PXB1-2", rollup: { dev: 5, ui: 0, qa: 0, spent: 0 } });
    expect(sortEpics([b, a], { key: "devEst", dir: "asc" }).map((e) => e.id)).toEqual(["PXB1-2", "PXB1-1"]);
  });
});

describe("sortStories", () => {
  const bug = { bugId: "B", summary: "", state: "OPEN", assignee: "", priority: "", devTicketId: "D" };
  const s1 = baseStory({ storyId: "PXB1-20", ddTs: 200, qaTs: null, bugs: [bug, bug] });
  const s2 = baseStory({ storyId: "PXB1-3", ddTs: 100, qaTs: 50, bugs: [] });
  it("dev deadline and QA deadline use the story's own dates", () => {
    expect(sortStories([s1, s2], { key: "maxDevDl", dir: "asc" }).map((s) => s.storyId)).toEqual(["PXB1-3", "PXB1-20"]);
    expect(sortStories([s1, s2], { key: "maxQaDl", dir: "desc" }).map((s) => s.storyId)).toEqual(["PXB1-3", "PXB1-20"]);
  });
  it("count sorts by bug count", () => {
    expect(sortStories([s2, s1], { key: "count", dir: "desc" }).map((s) => s.storyId)).toEqual(["PXB1-20", "PXB1-3"]);
  });
});
