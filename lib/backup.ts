import { calendarDaysBetween } from "./dates";

export const BACKUP_STALE_DAYS = 2;

export function backupIsStale(backupAt: Date | string | null | undefined, now = new Date()) {
  if (backupAt == null || backupAt === "") return true;
  return calendarDaysBetween(now, backupAt) >= BACKUP_STALE_DAYS;
}
