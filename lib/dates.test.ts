import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { laterInstant } from "./dates";

describe("later instant", () => {
  const earlier = new Date("2026-10-15T12:00:00-05:00");
  const later = new Date("2026-10-15T16:30:00-05:00");

  it("keeps a completion that is already later", () => {
    assert.equal(laterInstant(later, earlier), later);
  });

  it("moves forward when the new completion is later", () => {
    assert.equal(laterInstant(earlier, later), later);
  });

  it("uses the new completion when nothing is recorded yet", () => {
    assert.equal(laterInstant(null, earlier), earlier);
  });
});
