import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { householdLoad } from "./load";

describe("catch-up load", () => {
  it("counts overdue dirt, not chores that are only getting there", () => {
    const asOf = new Date("2026-08-19T12:00:00-05:00");
    const people = [{ dailyCapacity: 6, dailyTaskLimit: 4 }];
    const load = householdLoad(
      [
        { difficulty: 2, frequencyDays: 7, lastDoneAt: new Date("2026-08-12T12:00:00-05:00") },
        { difficulty: 3, frequencyDays: 7, lastDoneAt: new Date("2026-08-17T12:00:00-05:00") },
      ],
      people,
      asOf,
    );
    assert.equal(load.catchUp.tasks, 1);
    assert.equal(load.catchUp.pts, 2);
  });
});
