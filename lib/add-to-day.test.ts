import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { catalogAddAssignee, pickAddAssignee } from "./add-to-day";

const cass = "cass";
const jason = "jason";

describe("catalog add person", () => {
  it("uses the person chosen in the sheet and will move an existing row to them", () => {
    assert.deepEqual(catalogAddAssignee(jason, cass), { userId: jason, reassign: true });
  });

  it("falls back to the signed-in person when the sheet does not name anyone", () => {
    assert.deepEqual(catalogAddAssignee(undefined, cass), { userId: cass, reassign: false });
    assert.deepEqual(catalogAddAssignee("  ", cass), { userId: cass, reassign: false });
    assert.deepEqual(catalogAddAssignee(null, null), { userId: undefined, reassign: false });
  });
});

describe("who receives the chore", () => {
  it("gives a new chore to the chosen person", () => {
    assert.equal(pickAddAssignee({ preferredUserId: jason, allowedIds: [cass, jason] }), jason);
  });

  it("keeps a new chore with someone who can do it when the chosen person cannot", () => {
    assert.equal(pickAddAssignee({ preferredUserId: jason, allowedIds: [cass] }), cass);
  });

  it("leaves an existing row with its person unless this add named someone allowed", () => {
    assert.equal(pickAddAssignee({
      preferredUserId: jason,
      allowedIds: [cass, jason],
      currentUserId: cass,
    }), cass);
    assert.equal(pickAddAssignee({
      preferredUserId: jason,
      allowedIds: [cass, jason],
      currentUserId: cass,
      reassign: true,
    }), jason);
    assert.equal(pickAddAssignee({
      preferredUserId: jason,
      allowedIds: [cass],
      currentUserId: cass,
      reassign: true,
    }), cass);
  });
});
