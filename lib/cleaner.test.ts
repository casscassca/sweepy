import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  cleanerChecklist,
  cleanerCode,
  cleanerCodesMatch,
  cleanerCompletionName,
  cleanerSubmitLines,
  reopenAssignmentAfterUndo,
  completionLayers,
  linesForCleaner,
  previousLayerStamp,
} from "./cleaner";

const today = "2026-11-13";

describe("cleaner code", () => {
  it("keeps a 4-digit code and rejects anything else", () => {
    assert.equal(cleanerCode("1234"), "1234");
    assert.equal(cleanerCode(" 1234 "), "1234");
    assert.equal(cleanerCode("123"), "");
    assert.equal(cleanerCode("12345"), "");
    assert.equal(cleanerCode("12a4"), "");
  });

  it("matches only the saved code", () => {
    assert.equal(cleanerCodesMatch("2468", "2468"), true);
    assert.equal(cleanerCodesMatch("2468", "2469"), false);
    assert.equal(cleanerCodesMatch("2468", ""), false);
  });
});

describe("cleaner checklist", () => {
  const vacuum = {
    id: "vac",
    name: "Vacuum",
    frequencyDays: 7,
    lastDoneAt: new Date("2026-11-01T12:00:00-06:00"),
    addonName: "mop",
    addonFrequencyDays: 14,
    addonLastDoneAt: new Date("2026-11-13T09:00:00-06:00"),
    addon2Name: "baseboards",
    addon2FrequencyDays: 30,
    addon2LastDoneAt: null,
  };

  it("lists the chore and both add-ons, and capitalizes only the first letter", () => {
    const open = {
      ...vacuum,
      name: "sweep floors",
      addonName: "mop",
      addonLastDoneAt: new Date("2026-11-01T12:00:00-06:00"),
      addon2Name: "baseboards",
    };
    const sections = cleanerChecklist(
      [{ id: "kitchen", name: "Kitchen", icon: "🍳", tasks: [open] }],
      [],
      today,
    );
    assert.deepEqual(sections[0].lines.map((line) => [line.name, line.layer]), [
      ["Sweep floors", "base"],
      ["Mop", "addon"],
      ["Baseboards", "addon2"],
    ]);
  });

  it("keeps a line that was already done today, still unchecked", () => {
    const finished = {
      ...vacuum,
      lastDoneAt: new Date("2026-11-13T08:00:00-06:00"),
      addonLastDoneAt: new Date("2026-11-13T08:00:00-06:00"),
      addon2LastDoneAt: new Date("2026-11-13T08:00:00-06:00"),
    };
    const lines = linesForCleaner(finished, today);
    assert.deepEqual(lines.map((line) => [line.name, line.done]), [
      ["Vacuum", false],
      ["Mop", false],
      ["Baseboards", false],
    ]);
  });

  it("drops a room when every chore in it is hidden", () => {
    const hidden = { ...vacuum, hideFromCleaner: true };
    const sections = cleanerChecklist(
      [{ id: "kitchen", name: "Kitchen", icon: "🍳", tasks: [hidden] }],
      [],
      today,
    );
    assert.deepEqual(sections, []);
  });

  it("leaves off a chore marked hidden, and still shows the rest of the room", () => {
    const hidden = { ...vacuum, id: "bins", name: "Take out bins", hideFromCleaner: true, addonName: "", addonFrequencyDays: 0, addon2Name: "", addon2FrequencyDays: 0 };
    const lines = linesForCleaner(hidden, today);
    assert.deepEqual(lines, []);
    const sections = cleanerChecklist(
      [{ id: "kitchen", name: "Kitchen", icon: "🍳", tasks: [hidden, vacuum] }],
      [],
      today,
    );
    assert.deepEqual(sections[0].lines.map((line) => line.name), ["Vacuum", "Mop", "Baseboards"]);
  });

  it("names an add-on completion as just that add-on", () => {
    assert.equal(cleanerCompletionName(vacuum, "addon"), "mop");
    assert.equal(cleanerCompletionName(vacuum, "base"), "Vacuum");
  });
});

describe("undo a cleaner assignment", () => {
  it("drops the open chore when it was the cleaner's, and reopens anyone else's", () => {
    assert.equal(reopenAssignmentAfterUndo(true), false);
    assert.equal(reopenAssignmentAfterUndo(false), true);
  });
});

describe("cleaner submit", () => {
  it("keeps chosen lines and drops blanks and repeats", () => {
    assert.deepEqual(cleanerSubmitLines([
      { taskId: "vac", layer: "base" },
      { taskId: "vac", layer: "base" },
      { taskId: "vac", layer: "addon" },
      { taskId: "", layer: "base" },
      { taskId: "mop", layer: "nope" },
      null,
    ]), [
      { taskId: "vac", layer: "base" },
      { taskId: "vac", layer: "addon" },
    ]);
    assert.deepEqual(cleanerSubmitLines({}), []);
  });
});

describe("checking one part", () => {
  const vacuum = {
    name: "Vacuum",
    frequencyDays: 7,
    lastDoneAt: new Date("2026-11-12T12:00:00-06:00"),
    addonName: "mop",
    addonFrequencyDays: 14,
    addonLastDoneAt: new Date("2026-10-30T12:00:00-06:00"),
    addon2Name: "",
    addon2FrequencyDays: 0,
  };
  const today = new Date("2026-11-13T12:00:00-06:00");

  it("records only the vacuum when that is what was checked", () => {
    assert.deepEqual(completionLayers(vacuum, today, ["base"]), ["base"]);
  });

  it("records only the mop when the vacuum was already done", () => {
    assert.deepEqual(completionLayers(vacuum, today, ["addon"]), ["addon"]);
  });

  it("still records the base and a due add-on when the check does not say which part", () => {
    assert.deepEqual(completionLayers(vacuum, today), ["base", "addon"]);
  });
});

describe("undo a cleaner line", () => {
  const logs = [
    { id: "mop-now", completedAt: new Date("2026-11-13T15:00:00Z"), layer: "addon" },
    { id: "vac-old", completedAt: new Date("2026-11-01T15:00:00Z"), layer: "base" },
    { id: "mop-old", completedAt: new Date("2026-10-01T15:00:00Z"), layer: "addon" },
  ];

  it("restores the previous time for that line only", () => {
    assert.equal(previousLayerStamp(logs, "mop-now", "addon")?.toISOString(), "2026-10-01T15:00:00.000Z");
    assert.equal(previousLayerStamp(logs, "vac-old", "base")?.toISOString(), undefined);
    assert.equal(previousLayerStamp(logs, "mop-now", "base")?.toISOString(), "2026-11-01T15:00:00.000Z");
  });
});
