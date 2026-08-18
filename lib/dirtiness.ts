import { differenceInDays, subDays } from "date-fns";
import { formatFrequency } from "./frequency";

/** 0 = just cleaned, 1 = due, 3 = filthy / never done. */
export const DIRT_MAX = 3;

/** Hide from Today / Upcoming until at least this dirty (3/10 of the way to due). */
export const DIRT_SHOW_AT = 0.3;

function parseDate(value: Date | string): Date {
  return typeof value === "string" ? new Date(value) : value;
}

export function dirtinessRatio(
  lastDoneAt: Date | string | null,
  frequencyDays: number,
  asOf: Date = new Date(),
): number {
  if (!lastDoneAt || frequencyDays <= 0) return DIRT_MAX;
  const daysSince = differenceInDays(asOf, parseDate(lastDoneAt));
  return Math.min(DIRT_MAX, Math.max(0, daysSince / frequencyDays));
}

export function showAt(dueOnly?: boolean) {
  return dueOnly ? 1 : DIRT_SHOW_AT;
}

export function isDirtyEnough(
  lastDoneAt: Date | string | null,
  frequencyDays: number,
  asOf: Date = new Date(),
  dueOnly = false,
): boolean {
  return dirtinessRatio(lastDoneAt, frequencyDays, asOf) >= showAt(dueOnly);
}

export function lastDoneAtFromRatio(ratio: number, frequencyDays: number, asOf: Date = new Date()): Date | null {
  if (frequencyDays <= 0 || ratio >= DIRT_MAX - 0.05) return null;
  return subDays(asOf, ratio * frequencyDays);
}

export function dirtColor(ratio: number, alpha = 0.7): string {
  const t = Math.min(DIRT_MAX, Math.max(0, ratio)) / DIRT_MAX;
  // Same family as the difficulty pills + accent: lavender → violet → apricot → rose.
  const stops: [number, number, number][] = [
    [167, 139, 250],
    [124, 58, 237],
    [251, 146, 60],
    [248, 113, 113],
  ];
  const pos = t * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(pos));
  const f = pos - i;
  const a = stops[i];
  const b = stops[i + 1];
  const r = Math.round(a[0] + (b[0] - a[0]) * f);
  const g = Math.round(a[1] + (b[1] - a[1]) * f);
  const bl = Math.round(a[2] + (b[2] - a[2]) * f);
  return `rgba(${r}, ${g}, ${bl}, ${alpha})`;
}

export function roomDirtiness(
  tasks: Array<{ lastDoneAt: Date | string | null; frequencyDays: number }>,
  asOf: Date = new Date(),
): number {
  if (tasks.length === 0) return 0;
  const total = tasks.reduce((sum, t) => sum + dirtinessRatio(t.lastDoneAt, t.frequencyDays, asOf), 0);
  return total / tasks.length;
}

export function dirtWord(ratio: number): string {
  if (ratio < DIRT_SHOW_AT) return "clean";
  if (ratio < 1) return "getting there";
  if (ratio < 2) return "due";
  return "filthy";
}

export function dirtDetail(lastDoneAt: Date | string | null, frequencyDays: number, asOf: Date = new Date()): string {
  if (!lastDoneAt) return "Never cleaned — treating as filthy";
  const daysSince = differenceInDays(asOf, parseDate(lastDoneAt));
  return `Last done ${daysSince} day${daysSince === 1 ? "" : "s"} ago · ${formatFrequency(frequencyDays).toLowerCase()}`;
}
