import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { householdLoad } from "./load";

describe("catch-up load", () => {
  it("counts overdue dirt, not chores that are only getting there", () => {
    const asOf = new Date("2026-08-19T12:00:00-05:00");
    const people = [{ dailyCapacity: 6, dailyTaskLimit: 4 }];
    const load = householdLoad(
      [
        { difficulty: 2, frequencyDays: 7, lastDoneAt: new Date("2026-08-11T12:00:00-05:00") },
        { difficulty: 3, frequencyDays: 7, lastDoneAt: new Date("2026-08-12T12:00:00-05:00") },
        { difficulty: 3, frequencyDays: 7, lastDoneAt: new Date("2026-08-17T12:00:00-05:00") },
      ],
      people,
      asOf,
    );
    assert.equal(load.catchUp.tasks, 1);
    assert.equal(load.catchUp.pts, 2);
  });

  it("does not treat due-today as catch-up", () => {
    const asOf = new Date("2026-08-19T12:00:00-05:00");
    const load = householdLoad(
      [{ difficulty: 2, frequencyDays: 7, lastDoneAt: new Date("2026-08-12T12:00:00-05:00") }],
      [{ dailyCapacity: 6, dailyTaskLimit: 4 }],
      asOf,
    );
    assert.equal(load.catchUp.tasks, 0);
    assert.equal(load.catchUp.pts, 0);
  });

  it("typical week pts is limited by task seats times catalog mix", () => {
    const load = householdLoad(
      [
        { difficulty: 1, frequencyDays: 7, lastDoneAt: new Date("2026-08-18T12:00:00-05:00") },
        { difficulty: 1, frequencyDays: 7, lastDoneAt: new Date("2026-08-18T12:00:00-05:00") },
      ],
      [{ dailyCapacity: 6, dailyTaskLimit: 3, weekendShare: false }],
      new Date("2026-08-19T12:00:00-05:00"),
    );
    assert.equal(load.week.capPts, 42);
    assert.equal(load.week.capTasks, 21);
    assert.equal(load.week.typicalPts, 21);
  });
});
