import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cleanerLayerPoints, cleanerVisitSummary } from "./cleaner-points";

describe("cleaner points", () => {
  it("counts the chore, then each add-on on its own", () => {
    assert.equal(cleanerLayerPoints({ layer: "base", difficulty: 2, addonPoints: 1 }), 2);
    assert.equal(cleanerLayerPoints({ layer: "addon", difficulty: 2, addonPoints: 0 }), 0);
    assert.equal(cleanerLayerPoints({ layer: "addon2", difficulty: 2, addon2Points: 3 }), 3);
  });

  it("sums the latest visit, this month, and this year", () => {
    const summary = cleanerVisitSummary([
      { completedAt: new Date("2026-10-02T15:00:00Z"), points: 4 },
      { completedAt: new Date("2026-11-13T16:00:00Z"), points: 2 },
      { completedAt: new Date("2026-11-13T18:00:00Z"), points: 1 },
      { completedAt: new Date("2025-12-01T16:00:00Z"), points: 9 },
    ], "2026-11-13");
    assert.deepEqual(summary.last, { day: "2026-11-13", points: 3 });
    assert.equal(summary.month, 3);
    assert.equal(summary.year, 7);
  });

  it("stays empty when the cleaner has not checked anything off", () => {
    assert.deepEqual(cleanerVisitSummary([], "2026-11-13"), { last: null, month: 0, year: 0 });
  });
});
