import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mergeHistoryPage } from "./history";

const at = (iso: string) => new Date(iso);

describe("history page", () => {
  it("mixes cleaner notes into the completion log, newest first", () => {
    const { page, hasMore } = mergeHistoryPage(
      [{ kind: "completion" as const, id: "done", at: at("2026-11-13T15:00:00Z") }],
      [{ kind: "note" as const, id: "note", at: at("2026-11-13T18:00:00Z"), body: "wiped the fridge" }],
      60,
    );
    assert.equal(hasMore, false);
    assert.deepEqual(page.map((row) => row.id), ["note", "done"]);
  });

  it("keeps a note that would sit on the next page", () => {
    const completions = Array.from({ length: 3 }, (_, i) => ({
      id: `done-${i}`,
      at: at(`2026-11-13T1${i}:00:00Z`),
    }));
    const notes = [{ id: "note", at: at("2026-11-12T12:00:00Z") }];
    const first = mergeHistoryPage(completions, notes, 2);
    assert.deepEqual(first.page.map((row) => row.id), ["done-2", "done-1"]);
    assert.equal(first.hasMore, true);
    const cursor = first.page[first.page.length - 1].at;
    const rest = mergeHistoryPage(
      completions.filter((row) => row.at < cursor),
      notes.filter((row) => row.at < cursor),
      2,
    );
    assert.deepEqual(rest.page.map((row) => row.id), ["done-0", "note"]);
  });
});
