import { isAddon2Due, type AddonFields } from "./addon";
import { calendarDaysBetween } from "./dates";

export const RFID_DESICCANT_RESET_ENTITY = "button.one_rfid_smart_feeder_desiccant_reset";
export const FILTER_ADDON_NAME = "replace food/water filters";
export const DEFAULT_FILTER_CYCLE_DAYS = 30;

function foldName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function isFilterNamedTask(task: { name?: string | null }) {
  return foldName(task.name ?? "") === foldName(FILTER_ADDON_NAME);
}

export function isFilterAddonTask(task: { addon2Name?: string | null }) {
  return foldName(task.addon2Name ?? "") === foldName(FILTER_ADDON_NAME);
}

/** True when this completion updates the filter last-done date. */
export function shouldSyncRfidDesiccant(task: AddonFields, completedAt: Date = new Date()) {
  if (isFilterNamedTask(task)) return true;
  return isFilterAddonTask(task) && isAddon2Due(task, completedAt);
}

/**
 * Walk prior completions and recreate when the filter last-done would have
 * been stamped (each time the parent was completed while the filter was due).
 */
export function previousFilterLastDone(completionsAsc: Date[], frequencyDays: number): Date | null {
  const freq = Math.max(1, Math.round(frequencyDays) || DEFAULT_FILTER_CYCLE_DAYS);
  let last: Date | null = null;
  for (const at of completionsAsc) {
    if (!last || calendarDaysBetween(at, last) >= freq) last = at;
  }
  return last;
}

/** Press the feeder's desiccant reset. Does not change the cycle length. */
export async function pressRfidDesiccantReset() {
  const { appendIntegrationLog } = await import("./integration-log");
  const { haConfig, postHaService } = await import("./ha");

  const ha = haConfig();
  if (!ha) {
    await appendIntegrationLog({
      kind: "notify",
      ok: false,
      summary: "Petlibro desiccant reset skipped",
      detail: "HA_URL or HA_TOKEN is not set",
    });
    return { ok: false as const, reason: "HA not configured" };
  }

  const reset = await postHaService(ha, "button", "press", {
    entity_id: RFID_DESICCANT_RESET_ENTITY,
  });
  if (!reset.ok) {
    await appendIntegrationLog({
      kind: "notify",
      ok: false,
      summary: "Petlibro desiccant reset failed",
      detail: `${reset.status} ${reset.body.slice(0, 200)}`,
    });
    return { ok: false as const, reason: "reset failed" };
  }

  await appendIntegrationLog({
    kind: "notify",
    ok: true,
    summary: "Petlibro desiccant reset",
    detail: RFID_DESICCANT_RESET_ENTITY,
  });
  return { ok: true as const };
}

export async function syncRfidDesiccantOnFilterComplete(task: AddonFields, completedAt: Date) {
  if (!shouldSyncRfidDesiccant(task, completedAt)) {
    return { ok: true as const, skipped: true as const };
  }
  return pressRfidDesiccantReset();
}
