import { addCalendarDays } from "./dates";

export type VacationRange = {
  vacationOn?: boolean;
  vacationStart?: string | null;
  vacationEnd?: string | null;
};

export type HouseVacation = {
  houseVacation: boolean;
  houseVacationStart: string;
  houseVacationEnd: string;
  pauseDirtiness?: boolean;
  dirtFrozenOn?: string;
};

export function ymd(raw: unknown): string {
  return typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : "";
}

export function vacationActive(range: VacationRange, day: string): boolean {
  if (!range.vacationOn) return false;
  const start = range.vacationStart ?? "";
  const end = range.vacationEnd ?? "";
  if (start && day < start) return false;
  if (end && day > end) return false;
  return true;
}

export function houseVacationActive(house: HouseVacation, day: string): boolean {
  return vacationActive({
    vacationOn: house.houseVacation,
    vacationStart: house.houseVacationStart,
    vacationEnd: house.houseVacationEnd,
  }, day);
}

export function houseVacationExpired(house: HouseVacation, day: string): boolean {
  return house.houseVacation && !!house.houseVacationEnd && day > house.houseVacationEnd;
}

export function personAway(person: VacationRange, house: HouseVacation, day: string): boolean {
  return houseVacationActive(house, day) || vacationActive(person, day);
}

export function returnDay(person: VacationRange, house: HouseVacation, day: string): string | null {
  if (houseVacationActive(house, day) && house.houseVacationEnd) {
    return addCalendarDays(house.houseVacationEnd, 1);
  }
  if (vacationActive(person, day) && person.vacationEnd) {
    return addCalendarDays(person.vacationEnd, 1);
  }
  return null;
}

/** First calendar day on or after `from` when this person is home. */
export function nextPresentDay(
  person: VacationRange,
  house: HouseVacation,
  from: string,
  horizon = 60,
): string {
  let day = from;
  for (let i = 0; i < horizon; i++) {
    if (!personAway(person, house, day)) return day;
    const back = returnDay(person, house, day);
    day = back && back > day ? back : addCalendarDays(day, 1);
  }
  return from;
}

export function dirtAsOfDate(house: HouseVacation, day: string): Date {
  if (houseVacationActive(house, day) && house.pauseDirtiness && house.dirtFrozenOn) {
    return new Date(`${house.dirtFrozenOn}T12:00:00`);
  }
  return new Date();
}

export function dirtAsOfForTask(
  house: HouseVacation,
  day: string,
  task: { important?: boolean },
): Date {
  if (task.important && houseVacationActive(house, day) && house.pauseDirtiness && house.dirtFrozenOn) {
    return new Date(`${day}T12:00:00`);
  }
  return dirtAsOfDate(house, day);
}

export function uiDirtAsOf(task: { important?: boolean }, dirtAsOf?: Date) {
  return task.important ? undefined : dirtAsOf;
}

export function pausesDirtiness(task: { important?: boolean }) {
  return !task.important;
}

