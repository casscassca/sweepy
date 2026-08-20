import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { backupIsStale } from "./backup";

describe("backup freshness", () => {
  it("is stale when nothing has been recorded", () => {
    assert.equal(backupIsStale(null), true);
    assert.equal(backupIsStale(undefined), true);
    assert.equal(backupIsStale(""), true);
  });

  it("is fine the day after, and stale on the second Chicago day", () => {
    const backupAt = new Date("2026-08-18T09:00:00.000Z");
    assert.equal(backupIsStale(backupAt, new Date("2026-08-19T12:00:00.000-05:00")), false);
    assert.equal(backupIsStale(backupAt, new Date("2026-08-20T12:00:00.000-05:00")), true);
  });
});
