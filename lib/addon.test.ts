import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isCatchUpTask, isDueToday } from "./addon";

const asOf = new Date("2026-08-19T12:00:00-05:00");

describe("due vs overdue", () => {
  it("treats the due day as due today, not overdue", () => {
    const task = { difficulty: 2, frequencyDays: 7, lastDoneAt: new Date("2026-08-12T12:00:00-05:00") };
    assert.equal(isDueToday(task, asOf), true);
    assert.equal(isCatchUpTask(task, asOf), false);
  });

  it("treats past the due day as overdue, not due today", () => {
    const task = { difficulty: 2, frequencyDays: 7, lastDoneAt: new Date("2026-08-11T12:00:00-05:00") };
    assert.equal(isDueToday(task, asOf), false);
    assert.equal(isCatchUpTask(task, asOf), true);
  });

  it("treats never done as overdue", () => {
    const task = { difficulty: 2, frequencyDays: 7, lastDoneAt: null };
    assert.equal(isDueToday(task, asOf), false);
    assert.equal(isCatchUpTask(task, asOf), true);
  });
});
