const WEEK = 7;

export type LoadTask = {
  difficulty: number;
  frequencyDays: number;
  oneOff?: boolean;
  addonName?: string | null;
  addonFrequencyDays?: number | null;
  addonPoints?: number | null;
};

function addonOn(task: LoadTask) {
  return Boolean(task.addonName?.trim()) && (task.addonFrequencyDays ?? 0) > 0;
}

export type LoadPerson = {
  dailyCapacity: number;
  dailyTaskLimit: number;
};

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

export function householdLoad(tasks: LoadTask[], people: LoadPerson[]) {
  const catalog = tasks.filter((t) => !t.oneOff);
  const needPtsDay = catalog.reduce((s, t) => s + taskPointLoadPerDay(t), 0);
  const needTasksDay = catalog.reduce((s, t) => s + taskCountLoadPerDay(t), 0);
  const capPtsDay = people.reduce((s, p) => s + p.dailyCapacity, 0);
  const capTasksDay = people.reduce((s, p) => s + p.dailyTaskLimit, 0);

  return {
    taskCount: catalog.length,
    week: {
      needPts: needPtsDay * WEEK,
      capPts: capPtsDay * WEEK,
      needTasks: needTasksDay * WEEK,
      capTasks: capTasksDay * WEEK,
    },
    day: {
      needPts: needPtsDay,
      capPts: capPtsDay,
      needTasks: needTasksDay,
      capTasks: capTasksDay,
    },
  };
}
