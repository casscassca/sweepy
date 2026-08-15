import { prisma } from "./prisma";
import { haConfig } from "./ha";
import { format, addDays, differenceInDays, getDay } from "date-fns";

function earlyWindowDays(frequencyDays: number): number {
  return Math.min(7, Math.floor(frequencyDays / 10));
}

function todayStr() {
  return format(new Date(), "yyyy-MM-dd");
}

function daysUntilDue(lastDoneAt: Date | null, frequencyDays: number): number {
  if (!lastDoneAt) return -999;
  const dueDate = addDays(lastDoneAt, frequencyDays);
  return differenceInDays(dueDate, new Date());
}

// allowedDays is a comma-separated string of day numbers (0=Sun … 6=Sat), or null = any day
function isAllowedOnDate(allowedDays: string | null, date: Date): boolean {
  if (!allowedDays) return true;
  const allowed = allowedDays.split(",").map(Number);
  return allowed.includes(getDay(date));
}

/** Keep the earliest open assignment per task; drop later copies. */
export async function dedupeOpenAssignments() {
  const open = await prisma.dailyAssignment.findMany({
    where: { completedAt: null },
    orderBy: [{ date: "asc" }, { order: "asc" }],
    select: { id: true, taskId: true },
  });
  const seen = new Set<string>();
  const extra: string[] = [];
  for (const a of open) {
    if (seen.has(a.taskId)) extra.push(a.id);
    else seen.add(a.taskId);
  }
  if (extra.length > 0) {
    await prisma.dailyAssignment.deleteMany({ where: { id: { in: extra } } });
  }
  return extra.length;
}

export async function runDailyAssignment(dateStr?: string) {
  const date = dateStr ?? todayStr();
  const targetDate = new Date(date + "T12:00:00"); // noon to avoid DST edge cases

  const [tasks, users, existing, openElsewhere] = await Promise.all([
    prisma.task.findMany({
      include: { assignableUsers: { include: { user: true } } },
    }),
    prisma.user.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.dailyAssignment.findMany({
      where: { date },
      include: { task: { select: { difficulty: true } } },
    }),
    prisma.dailyAssignment.findMany({
      where: { completedAt: null, date: { not: date } },
      select: { taskId: true },
    }),
  ]);

  const alreadyAssignedIds = new Set(existing.map((a) => a.taskId));
  const blockedIds = new Set(openElsewhere.map((a) => a.taskId));

  const eligible = tasks
    .filter((t) => !alreadyAssignedIds.has(t.id) && !blockedIds.has(t.id))
    .filter((t) => isAllowedOnDate(t.allowedDays, targetDate))
    .map((t) => ({ task: t, daysUntil: daysUntilDue(t.lastDoneAt, t.frequencyDays) }))
    .filter(({ task, daysUntil }) => daysUntil <= earlyWindowDays(task.frequencyDays))
    .sort((a, b) => a.daysUntil - b.daysUntil);

  if (eligible.length === 0) return { assigned: 0 };

  const capacityLeft = new Map<string, number>(users.map((u) => [u.id, u.dailyCapacity]));
  const orderCounters = new Map<string, number>(users.map((u) => [u.id, 0]));
  for (const a of existing) {
    capacityLeft.set(a.userId, (capacityLeft.get(a.userId) ?? 0) - a.task.difficulty);
    orderCounters.set(a.userId, (orderCounters.get(a.userId) ?? 0) + 1);
  }

  const toCreate: Array<{ date: string; userId: string; taskId: string; order: number }> = [];

  for (const { task } of eligible) {
    const assignableUserIds =
      task.assignableUsers.length > 0
        ? task.assignableUsers.map((au: { userId: string }) => au.userId)
        : users.map((u) => u.id);

    let bestUser: string | null = null;
    let bestCapacity = -1;
    for (const uid of assignableUserIds) {
      const cap = capacityLeft.get(uid) ?? 0;
      if (cap >= task.difficulty && cap > bestCapacity) {
        bestCapacity = cap;
        bestUser = uid;
      }
    }

    if (!bestUser) continue;

    capacityLeft.set(bestUser, (capacityLeft.get(bestUser) ?? 0) - task.difficulty);
    const order = orderCounters.get(bestUser) ?? 0;
    orderCounters.set(bestUser, order + 1);
    toCreate.push({ date, userId: bestUser, taskId: task.id, order });
  }

  if (toCreate.length > 0) {
    await prisma.dailyAssignment.createMany({ data: toCreate });
  }

  return { assigned: toCreate.length };
}

export async function sendNotificationsForTime(timeStr: string) {
  const date = todayStr();
  const users = await prisma.user.findMany({
    where: { notifyTime: timeStr, haNotifyTarget: { not: "" } },
  });

  if (users.length === 0) return;

  const ha = haConfig();
  if (!ha) return;

  for (const user of users) {
    const assignments = await prisma.dailyAssignment.findMany({
      where: { date, userId: user.id, completedAt: null },
      include: { task: { include: { room: true } } },
      orderBy: { order: "asc" },
    });

    if (assignments.length === 0) continue;

    for (const assignment of assignments) {
      const notifyTarget = user.haNotifyTarget.replace("notify.", "");
      const difficulty = ["", "quick", "medium", "big job"][assignment.task.difficulty];

      await fetch(`${ha.url}/api/services/notify/${notifyTarget}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ha.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: `${assignment.task.room.name}: ${assignment.task.name}`,
          message: `${difficulty} · tap an action below`,
          data: {
            actions: [
              { action: `MARK_DONE_${assignment.id}`, title: "✅ Done" },
              { action: `DEFER_${assignment.id}`, title: "⏭️ Tomorrow" },
            ],
          },
        }),
      }).catch(console.error);
    }
  }
}
