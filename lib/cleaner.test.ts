import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  cleanerChecklist,
  cleanerCode,
  cleanerCodesMatch,
  cleanerCompletionName,
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

  it("lists every chore in the room, with each add-on on its own line", () => {
    const sections = cleanerChecklist(
      [{ id: "kitchen", name: "Kitchen", icon: "🍳", tasks: [vacuum] }],
      [],
      today,
    );
    assert.equal(sections.length, 1);
    assert.deepEqual(sections[0].lines.map((line) => [line.name, line.layer, line.done]), [
      ["Vacuum", "base", false],
      ["mop", "addon", true],
      ["baseboards", "addon2", false],
    ]);
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
    assert.equal(sections[0].lines[0].name, "Vacuum");
  });

  it("names an add-on completion as just that add-on", () => {
    assert.equal(cleanerCompletionName(vacuum, "addon"), "mop");
    assert.equal(cleanerCompletionName(vacuum, "base"), "Vacuum");
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
