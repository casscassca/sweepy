import { calendarDayStr } from "./dates";

export function cleanerLayerPoints(log: {
  layer?: string;
  difficulty?: number | null;
  addonPoints?: number | null;
  addon2Points?: number | null;
}) {
  if (log.layer === "addon") return Math.max(0, log.addonPoints ?? 1);
  if (log.layer === "addon2") return Math.max(0, log.addon2Points ?? 1);
  return Math.max(0, log.difficulty ?? 1);
}

export type CleanerVisit = { day: string; points: number };

/** Points from the cleaner’s latest visit, plus this month and this year. Days are yyyy-mm-dd. */
export function cleanerVisitSummary(
  logs: { completedAt: Date; points: number }[],
  today: string,
): { last: CleanerVisit | null; month: number; year: number } {
  const monthKey = today.slice(0, 7);
  const yearKey = today.slice(0, 4);
  const byDay = new Map<string, number>();
  let month = 0;
  let year = 0;
  for (const log of logs) {
    const day = calendarDayStr(log.completedAt);
    byDay.set(day, (byDay.get(day) ?? 0) + log.points);
    if (day.slice(0, 4) === yearKey) year += log.points;
    if (day.slice(0, 7) === monthKey) month += log.points;
  }
  let lastDay = "";
  for (const day of byDay.keys()) {
    if (day > lastDay) lastDay = day;
  }
  return {
    last: lastDay ? { day: lastDay, points: byDay.get(lastDay) ?? 0 } : null,
    month,
    year,
  };
}
