import { describe, expect, it } from "vitest";
import { filterByPriority, groupModuleInsights, priorityOptions, submoduleFoldKey } from "../lib/bug-modules";
import type { Bug } from "../lib/types";

function bug(overrides: Partial<Bug>): Bug {
  return {
    id: "PXB1-1",
    summary: "x",
    created: 1,
    state: "OPEN",
    priority: "High",
    module: "Sale",
    submodule: null,
    assignee: "",
    reporter: "",
    ...overrides,
  };
}

describe("submoduleFoldKey", () => {
  it("folds casing and a trailing plural on the last word", () => {
    expect(submoduleFoldKey("Laybuy Report")).toBe(submoduleFoldKey("Laybuy report"));
    expect(submoduleFoldKey("Purchase Return")).toBe(submoduleFoldKey("Purchase Returns"));
  });

  it("does not fold a short acronym-like last word", () => {
    expect(submoduleFoldKey("Web POS")).toBe("web pos");
    expect(submoduleFoldKey("POS")).toBe("pos");
  });

  it("does not strip a double-s ending", () => {
    expect(submoduleFoldKey("Database Access")).toBe("database access");
  });
});

describe("groupModuleInsights", () => {
  it("merges casing/pluralization duplicates with no alias needed, majority vote wins", () => {
    const bugs = [
      ...Array(4).fill(bug({ submodule: "Widget Config" })),
      bug({ submodule: "widget config" }),
      bug({ submodule: "Widget Configs" }),
    ];
    const mods = groupModuleInsights(bugs);
    expect(mods[0].submodules).toEqual([{ submodule: "Widget Config", count: 6 }]);
  });

  it("ties break toward the Title Case spelling", () => {
    const bugs = [bug({ submodule: "Widget Config" }), bug({ submodule: "widget config" })];
    const mods = groupModuleInsights(bugs);
    expect(mods[0].submodules).toEqual([{ submodule: "Widget Config", count: 2 }]);
  });
});

describe("priorityOptions / filterByPriority", () => {
  it("derives options from present values and buckets blank priority as No Priority", () => {
    const bugs = [bug({ priority: "Urgent" }), bug({ priority: "High" }), bug({ priority: "" })];
    expect(priorityOptions(bugs)).toEqual(["Urgent", "High", "No Priority"]);
    expect(filterByPriority(bugs, new Set(["Urgent"]))).toHaveLength(1);
    expect(filterByPriority(bugs, new Set(["No Priority"]))).toHaveLength(1);
  });
});
