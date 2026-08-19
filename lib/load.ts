import { displayTaskDifficulty, isAddonDue } from "./addon";
import { weekCapacity, type PersonCaps } from "./capacity";
import { dirtinessRatio } from "./dirtiness";

export type LoadTask = {
  difficulty: number;
  frequencyDays: number;
  lastDoneAt?: Date | string | null;
  oneOff?: boolean;
  addonName?: string | null;
  addonFrequencyDays?: number | null;
  addonPoints?: number | null;
  addonLastDoneAt?: Date | string | null;
};

function addonOn(task: LoadTask) {
  return Boolean(task.addonName?.trim()) && (task.addonFrequencyDays ?? 0) > 0;
}

export type LoadPerson = PersonCaps;

export function taskPointLoadPerDay(task: LoadTask) {
  if (task.oneOff || task.frequencyDays <= 0) return 0;
  const base = task.difficulty / task.frequencyDays;
  const extra = addonOn(task) ? Math.max(1, task.addonPoints ?? 1) / (task.addonFrequencyDays as number) : 0;
  return base + extra;
}

export function taskCountLoadPerDay(task: LoadTask) {
  if (task.oneOff || task.frequencyDays <= 0) return 0;
  return 1 / task.frequencyDays;
}

function isBehindHealthy(task: LoadTask, asOf: Date) {
  return dirtinessRatio(task.lastDoneAt ?? null, task.frequencyDays, asOf) >= 1 || isAddonDue(task, asOf);
}

export function householdLoad(tasks: LoadTask[], people: LoadPerson[], asOf: Date = new Date()) {
  const catalog = tasks.filter((t) => !t.oneOff);
  const needPtsDay = catalog.reduce((s, t) => s + taskPointLoadPerDay(t), 0);
  const needTasksDay = catalog.reduce((s, t) => s + taskCountLoadPerDay(t), 0);
  const weekCap = weekCapacity(people);
  const overdue = catalog.filter((t) => isBehindHealthy(t, asOf));

  return {
    taskCount: catalog.length,
    week: {
      needPts: needPtsDay * 7,
      capPts: weekCap.pts,
      needTasks: needTasksDay * 7,
      capTasks: weekCap.tasks,
    },
    day: {
      needPts: needPtsDay,
      capPts: weekCap.pts / 7,
      needTasks: needTasksDay,
      capTasks: weekCap.tasks / 7,
    },
    catchUp: {
      pts: overdue.reduce((s, t) => s + displayTaskDifficulty(t, asOf), 0),
      tasks: overdue.length,
    },
  };
}
