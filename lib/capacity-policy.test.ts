import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canSpillForCapacity, keepsDueDay, mayExceedCapacity, rankForSpill } from "./capacity-policy";

const chore = (over: Partial<{ pinned: boolean; held: boolean; exclusive: boolean; oneOff: boolean; important: boolean }>) => ({
  pinned: over.pinned ?? false,
  held: over.held ?? false,
  exclusive: over.exclusive ?? false,
  task: { oneOff: over.oneOff ?? false, important: over.important ?? false },
});

describe("capacity overrides", () => {
  it("counts a pin toward the cap and will not spill it", () => {
    const pin = chore({ pinned: true, held: true });
    assert.equal(mayExceedCapacity(pin), false);
    assert.equal(canSpillForCapacity(pin), false);
  });

  it("counts a one-off toward the cap and will not spill it", () => {
    const extra = chore({ oneOff: true, held: true });
    assert.equal(mayExceedCapacity(extra), true);
    assert.equal(canSpillForCapacity(extra), false);
  });

  it("spills a dragged chore when a pin already fills the cap", () => {
    const moved = chore({ held: true });
    assert.equal(mayExceedCapacity(moved), false);
    assert.equal(canSpillForCapacity(moved), true);
  });

  it("spills autos before a dragged chore", () => {
    const auto = { ...chore({}), dirt: 1 };
    const moved = { ...chore({ held: true }), dirt: 0.1 };
    assert.deepEqual(
      rankForSpill([moved, auto]).map((r) => r.dirt),
      [1, 0.1],
    );
  });

  it("lets exclusive important chores sit over the cap", () => {
    const onlyTheirs = chore({ important: true, exclusive: true });
    assert.equal(mayExceedCapacity(onlyTheirs), true);
    assert.equal(canSpillForCapacity(onlyTheirs), false);
  });

  it("keeps an important chore on its due day when nobody else has room", () => {
    assert.equal(keepsDueDay(chore({ important: true })), true);
    assert.equal(keepsDueDay(chore({ important: true, exclusive: true })), true);
    assert.equal(keepsDueDay(chore({})), false);
  });

  it("spills a regular or due-only auto once the cap is hit", () => {
    assert.equal(canSpillForCapacity(chore({})), true);
    assert.equal(canSpillForCapacity(chore({ important: true })), true);
    assert.equal(canSpillForCapacity(chore({ exclusive: true })), true);
  });

  it("spills clean regulars before important ones", () => {
    const dirty = { ...chore({}), dirt: 2 };
    const important = { ...chore({ important: true }), dirt: 0.4 };
    const clean = { ...chore({}), dirt: 0.5 };
    assert.deepEqual(
      rankForSpill([important, dirty, clean]).map((r) => r.dirt),
      [0.5, 2, 0.4],
    );
  });
});
