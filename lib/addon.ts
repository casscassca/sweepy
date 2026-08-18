import { dirtinessRatio, isDirtyEnough } from "./dirtiness";
import { formatFrequency } from "./frequency";

export type AddonFields = {
  name: string;
  difficulty: number;
  lastDoneAt: Date | string | null;
  frequencyDays: number;
  dueOnly?: boolean;
  addonName?: string | null;
  addonFrequencyDays?: number | null;
  addonPoints?: number | null;
  addonLastDoneAt?: Date | string | null;
};

export function hasAddon(task: AddonFields) {
  return Boolean(task.addonName?.trim()) && (task.addonFrequencyDays ?? 0) > 0;
}

export function isAddonDue(task: AddonFields, asOf: Date = new Date()) {
  if (!hasAddon(task)) return false;
  return dirtinessRatio(task.addonLastDoneAt ?? null, task.addonFrequencyDays as number, asOf) >= 1;
}

export function displayTaskName(task: AddonFields, asOf: Date = new Date()) {
  if (!isAddonDue(task, asOf)) return task.name;
  return `${task.name} and ${task.addonName!.trim()}`;
}

function completedWithAddon(task: AddonFields, completedAt?: Date | string | null) {
  if (!completedAt || !task.addonLastDoneAt || !hasAddon(task)) return false;
  return Math.abs(new Date(completedAt).getTime() - new Date(task.addonLastDoneAt).getTime()) < 60_000;
}

export function assignmentLabel(task: AddonFields, completedAt?: Date | string | null) {
  if (completedWithAddon(task, completedAt)) return `${task.name} and ${task.addonName!.trim()}`;
  return displayTaskName(task);
}

export function assignmentDifficulty(task: AddonFields, completedAt?: Date | string | null) {
  if (completedWithAddon(task, completedAt)) {
    return Math.min(3, task.difficulty + Math.max(1, task.addonPoints ?? 1));
  }
  return displayTaskDifficulty(task);
}

export function displayTaskDifficulty(task: AddonFields, asOf: Date = new Date()) {
  if (!isAddonDue(task, asOf)) return task.difficulty;
  return Math.min(3, task.difficulty + Math.max(1, task.addonPoints ?? 1));
}

export function isTaskEligible(task: AddonFields, asOf: Date = new Date()) {
  return isDirtyEnough(task.lastDoneAt, task.frequencyDays, asOf, task.dueOnly) || isAddonDue(task, asOf);
}

export function addonDetail(task: AddonFields) {
  if (!hasAddon(task)) return "";
  return `also ${task.addonName!.trim()} · ${formatFrequency(task.addonFrequencyDays as number).toLowerCase()}`;
}

export function addonFields(body: {
  addonName?: unknown;
  addonFrequencyDays?: unknown;
  addonPoints?: unknown;
  addonLastDoneAt?: unknown;
}) {
  const name = typeof body.addonName === "string" ? body.addonName.trim().slice(0, 80) : "";
  const frequencyDays = name ? Math.max(0, Math.round(Number(body.addonFrequencyDays) || 0)) : 0;
  const on = Boolean(name) && frequencyDays > 0;
  return {
    addonName: on ? name : "",
    addonFrequencyDays: on ? frequencyDays : 0,
    addonPoints: on ? Math.min(2, Math.max(1, Math.round(Number(body.addonPoints) || 1))) : 1,
    addonLastDoneAt: on && typeof body.addonLastDoneAt === "string" && body.addonLastDoneAt
      ? new Date(body.addonLastDoneAt)
      : null,
  };
}
