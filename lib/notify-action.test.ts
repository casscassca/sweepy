import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ignoreNotifyAction, parseNotifyAction } from "./notify-action";

describe("notify actions", () => {
  it("parses Sweepy button actions", () => {
    assert.deepEqual(parseNotifyAction("MARK_DONE_abc"), { kind: "done", assignmentId: "abc" });
    assert.deepEqual(parseNotifyAction("DONE_abc"), { kind: "done", assignmentId: "abc" });
    assert.deepEqual(parseNotifyAction("DEFER_abc"), { kind: "tomorrow", assignmentId: "abc" });
    assert.deepEqual(parseNotifyAction("DELAY_abc"), { kind: "later", assignmentId: "abc" });
  });

  it("ignores other Home Assistant notification actions without treating them as Sweepy taps", () => {
    assert.equal(parseNotifyAction("MOW_YARD_CLEAR"), null);
    assert.equal(parseNotifyAction(""), null);
    assert.equal(ignoreNotifyAction("MOW_YARD_CLEAR", "ha-event"), true);
    assert.equal(ignoreNotifyAction("", "ha-event"), true);
    assert.equal(ignoreNotifyAction("MARK_DONE_abc", "ha-event"), false);
    assert.equal(ignoreNotifyAction("MOW_YARD_CLEAR", "webhook"), false);
  });
});
