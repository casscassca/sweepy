/** Household calendar — due days follow Chicago, not the server’s UTC clock. */
export const HOUSEHOLD_TZ = "America/Chicago";

export function calendarDayStr(value: Date | string = new Date(), timeZone = HOUSEHOLD_TZ): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(typeof value === "string" ? new Date(value) : value);
}

export function calendarDaysBetween(later: Date | string, earlier: Date | string): number {
  const [ly, lm, ld] = calendarDayStr(later).split("-").map(Number);
  const [ey, em, ed] = calendarDayStr(earlier).split("-").map(Number);
  return Math.round((Date.UTC(ly, lm - 1, ld) - Date.UTC(ey, em - 1, ed)) / 86_400_000);
}

export function addCalendarDays(day: string, days: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + days));
  const yy = next.getUTCFullYear();
  const mm = String(next.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(next.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}
