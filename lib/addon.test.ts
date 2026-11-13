import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { addonFields, displayTaskDifficulty, displayTaskName, isAddon2Due, isAddonDue, isCatchUpTask, isDueToday, isTaskEligible } from "./addon";
import { dueDayStr } from "./dirtiness";

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

describe("nested add-on", () => {
  const food = {
    name: "Reset wet food",
    difficulty: 1,
    frequencyDays: 3,
    lastDoneAt: new Date("2026-08-16T12:00:00-05:00"),
    dueOnly: true,
    addonName: "clean filter",
    addonFrequencyDays: 6,
    addonPoints: 1,
    addonLastDoneAt: new Date("2026-08-13T12:00:00-05:00"),
    addon2Name: "replace filter",
    addon2FrequencyDays: 30,
    addon2Points: 2,
    addon2LastDoneAt: new Date("2026-07-20T12:00:00-05:00"),
  };

  it("names the full stack when the second add-on is due", () => {
    assert.equal(displayTaskName(food, asOf), "Reset wet food, clean filter, and replace filter");
    assert.equal(isTaskEligible(food, asOf), true);
  });

  it("keeps add-on titles capitalized in storage but folds them in the row name", () => {
    const titled = { ...food, addonName: "Clean filter", addon2Name: "Replace filter" };
    assert.equal(displayTaskName(titled, asOf), "Reset wet food, clean filter, and replace filter");
    assert.equal(titled.addonName, "Clean filter");
  });

  it("keeps a due-only chore off the list when only the nested add-on is due", () => {
    const onlyStack = {
      ...food,
      lastDoneAt: new Date("2026-08-18T12:00:00-05:00"),
      addonLastDoneAt: new Date("2026-08-18T12:00:00-05:00"),
    };
    assert.equal(isAddonDue(onlyStack, asOf), false);
    assert.equal(isAddon2Due(onlyStack, asOf), true);
    assert.equal(isDueToday(onlyStack, asOf), false);
    assert.equal(isCatchUpTask(onlyStack, asOf), false);
    assert.equal(isTaskEligible(onlyStack, asOf), false);
    const baseDue = new Date("2026-08-21T12:00:00-05:00");
    assert.equal(isTaskEligible(onlyStack, baseDue), true);
    assert.equal(isDueToday(onlyStack, baseDue), true);
    assert.equal(displayTaskName(onlyStack, baseDue), "Reset wet food, clean filter, and replace filter");
  });

  it("drops the second add-on when the first is off", () => {
    const parsed = addonFields({ addonName: "", addon2Name: "replace filter", addon2FrequencyDays: 30 });
    assert.equal(parsed.addon2Name, "");
    assert.equal(parsed.addon2FrequencyDays, 0);
  });

  it("lets an add-on be worth zero points", () => {
    const parsed = addonFields({ addonName: "clean filter", addonFrequencyDays: 6, addonPoints: 0 });
    assert.equal(parsed.addonPoints, 0);
    const zeroExtra = { ...food, addonPoints: 0, addon2Name: "", addon2FrequencyDays: 0 };
    assert.equal(displayTaskDifficulty(zeroExtra, asOf), 1);
  });
});

describe("Reset wet food add-ons do not pull the base due", () => {
  // Base finished Wed Nov 11 at noon Chicago. Every 3 days, only when due.
  // clean setup (6 days) and replace food/water filters (1 month) both come due Fri Nov 13.
  const wednesday = new Date("2026-11-11T12:00:00-06:00");
  const friday = new Date("2026-11-13T12:00:00-06:00");
  const saturday = new Date("2026-11-14T12:00:00-06:00");
  const wetFood = {
    name: "Reset wet food",
    difficulty: 1,
    important: true,
    frequencyDays: 3,
    lastDoneAt: wednesday,
    dueOnly: true,
    addonName: "clean setup",
    addonFrequencyDays: 6,
    addonPoints: 1,
    addonLastDoneAt: new Date("2026-11-07T12:00:00-06:00"),
    addon2Name: "replace food/water filters",
    addon2FrequencyDays: 30,
    addon2Points: 1,
    addon2LastDoneAt: new Date("2026-10-14T12:00:00-06:00"),
  };

  it("names only the base on Wednesday, before either add-on is due", () => {
    assert.equal(isAddonDue(wetFood, wednesday), false);
    assert.equal(isAddon2Due(wetFood, wednesday), false);
    assert.equal(displayTaskName(wetFood, wednesday), "Reset wet food");
  });

  it("stays off Today on Friday when only the add-ons are due", () => {
    assert.equal(dueDayStr(wetFood.lastDoneAt, wetFood.frequencyDays), "2026-11-14");
    assert.equal(isAddonDue(wetFood, friday), true);
    assert.equal(isAddon2Due(wetFood, friday), true);
    assert.equal(isDueToday(wetFood, friday), false);
    assert.equal(isCatchUpTask(wetFood, friday), false);
    assert.equal(isTaskEligible(wetFood, friday), false);
  });

  it("does not treat an overdue add-on as a past-due base", () => {
    const overdueAddon = {
      ...wetFood,
      addonLastDoneAt: new Date("2026-11-06T12:00:00-06:00"),
    };
    assert.equal(isAddonDue(overdueAddon, friday), true);
    assert.equal(isCatchUpTask(overdueAddon, friday), false);
    assert.equal(isDueToday(overdueAddon, friday), false);
    assert.equal(isTaskEligible(overdueAddon, friday), false);
  });

  it("attaches the waiting add-ons on Saturday, when the base is due", () => {
    assert.equal(isAddonDue(wetFood, saturday), true);
    assert.equal(isAddon2Due(wetFood, saturday), true);
    assert.equal(isCatchUpTask(wetFood, saturday), false);
    assert.equal(isDueToday(wetFood, saturday), true);
    assert.equal(isTaskEligible(wetFood, saturday), true);
    assert.equal(
      displayTaskName(wetFood, saturday),
      "Reset wet food, clean setup, and replace food/water filters",
    );
    assert.equal(displayTaskDifficulty(wetFood, saturday), 3);
  });

  it("still shows a base that is getting there when it is not due-only", () => {
    const early = {
      ...wetFood,
      dueOnly: false,
      lastDoneAt: new Date("2026-11-12T12:00:00-06:00"),
    };
    assert.equal(isTaskEligible(early, friday), true);
    assert.equal(isDueToday(early, friday), false);
  });

  it("does not show a still-clean base just because an add-on is due", () => {
    const clean = { ...wetFood, dueOnly: false, lastDoneAt: friday };
    assert.equal(isAddonDue(clean, friday), true);
    assert.equal(isTaskEligible(clean, friday), false);
    assert.equal(isDueToday(clean, friday), false);
  });
});
