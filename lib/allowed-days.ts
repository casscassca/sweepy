import { addCalendarDays, calendarDayStr } from "./dates";

export const DAY_SHORT = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;
export const DAY_FULL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function weekdayOfDayStr(day: string): number {
  const [y, m, d] = day.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function parseAllowedDays(raw: string | null | undefined): number[] | null {
  if (!raw?.trim()) return null;
  const days = [...new Set(raw.split(",").map((s) => Number(s.trim())))]
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
    .sort((a, b) => a - b);
  if (days.length === 0 || days.length === 7) return null;
  return days;
}

export function encodeAllowedDays(days: number[]): string | null {
  const unique = [...new Set(days.filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))]
    .sort((a, b) => a - b);
  if (unique.length === 0 || unique.length === 7) return null;
  return unique.join(",");
}

export function normalizeAllowedDays(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  if (Array.isArray(raw)) return encodeAllowedDays(raw.map(Number));
  if (typeof raw === "string") {
    const parsed = parseAllowedDays(raw);
    return parsed ? parsed.join(",") : null;
  }
  return null;
}

export function isAllowedOnDate(allowedDays: string | null | undefined, date: Date | string): boolean {
  const days = parseAllowedDays(allowedDays);
  if (!days) return true;
  const dayStr = typeof date === "string" ? date.slice(0, 10) : calendarDayStr(date);
  return days.includes(weekdayOfDayStr(dayStr));
}

export function nextAllowedOnOrAfter(
  allowedDays: string | null | undefined,
  from: string,
  until?: string,
): string | null {
  let day = from.slice(0, 10);
  const end = (until ?? addCalendarDays(day, 21)).slice(0, 10);
  while (day <= end) {
    if (isAllowedOnDate(allowedDays, day)) return day;
    day = addCalendarDays(day, 1);
  }
  return null;
}

export function formatAllowedDays(raw: string | null | undefined): string {
  const days = parseAllowedDays(raw);
  if (!days) return "";
  return days.map((d) => DAY_FULL[d]).join(", ");
}

export function allowedMask(raw: string | null | undefined): boolean[] {
  const days = parseAllowedDays(raw);
  if (!days) return [true, true, true, true, true, true, true];
  return [0, 1, 2, 3, 4, 5, 6].map((i) => days.includes(i));
}
