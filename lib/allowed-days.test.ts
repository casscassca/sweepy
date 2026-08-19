import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { allowedMask, encodeAllowedDays, parseAllowedDays } from "./allowed-days";

describe("allowed days", () => {
  it("treats none or all days as any day", () => {
    assert.equal(parseAllowedDays(null), null);
    assert.equal(encodeAllowedDays([]), null);
    assert.equal(encodeAllowedDays([0, 1, 2, 3, 4, 5, 6]), null);
    assert.deepEqual(allowedMask(null), [false, false, false, false, false, false, false]);
  });

  it("stores Wednesday-only as 3", () => {
    assert.deepEqual(parseAllowedDays("3"), [3]);
    assert.equal(encodeAllowedDays([3]), "3");
    assert.deepEqual(allowedMask("3"), [false, false, false, true, false, false, false]);
  });
});
