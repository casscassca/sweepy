import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  dirtAsOfDate,
  dirtAsOfForTask,
  houseVacationExpired,
  nextPresentDay,
  pausesDirtiness,
  returnDay,
  uiDirtAsOf,
} from "./vacation";

const house = {
  houseVacation: true,
  houseVacationStart: "2026-08-10",
  houseVacationEnd: "2026-08-24",
  pauseDirtiness: true,
  dirtFrozenOn: "2026-08-10",
};

describe("vacation dirt pause", () => {
  it("freezes regular chores on the dirt clock", () => {
    const asOf = dirtAsOfDate(house, "2026-08-20");
    assert.equal(asOf.toISOString().slice(0, 10), "2026-08-10");
    assert.equal(pausesDirtiness({ important: false }), true);
    assert.equal(uiDirtAsOf({ important: false }, asOf), asOf);
  });

  it("lets Important chores keep aging through the pause", () => {
    const asOf = dirtAsOfForTask(house, "2026-08-20", { important: true });
    assert.equal(asOf.toISOString().slice(0, 10), "2026-08-20");
    assert.equal(pausesDirtiness({ important: true }), false);
    assert.equal(uiDirtAsOf({ important: true }, new Date("2026-08-10T12:00:00")), undefined);
  });

  it("resumes the day after the house vacation ends", () => {
    assert.equal(returnDay({ vacationOn: false }, house, "2026-08-20"), "2026-08-25");
    assert.equal(nextPresentDay({ vacationOn: false }, house, "2026-08-20"), "2026-08-25");
    assert.equal(nextPresentDay({ vacationOn: false }, house, "2026-08-25"), "2026-08-25");
  });

  it("clears the house vacation box once the end date has passed", () => {
    assert.equal(houseVacationExpired(house, "2026-08-24"), false);
    assert.equal(houseVacationExpired(house, "2026-08-25"), true);
    assert.equal(houseVacationExpired({ ...house, houseVacationEnd: "" }, "2026-08-25"), false);
  });

  it("uses the live clock for Important and regular chores when not paused", () => {
    const open = {
      ...house,
      pauseDirtiness: false,
      dirtFrozenOn: "",
    };
    const regular = dirtAsOfForTask(open, "2026-08-20", { important: false });
    const important = dirtAsOfForTask(open, "2026-08-20", { important: true });
    assert.ok(Math.abs(regular.getTime() - Date.now()) < 60_000);
    assert.ok(Math.abs(important.getTime() - Date.now()) < 60_000);
  });
});
