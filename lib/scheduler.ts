import { prisma } from "./prisma";
import { haConfig, listHaNotifyCatalog, postNotify, resolveNotifyTarget } from "./ha";
import { appendIntegrationLog } from "./integration-log";
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

export type NotifyAttempt = {
  taskName: string;
  service: string;
  url: string;
  ok: boolean;
  status: number;
  detail: string;
};

async function logNotify(entry: {
  ok: boolean;
  userName: string;
  summary: string;
  detail?: string;
}) {
  console[entry.ok ? "log" : "error"](`[notify] ${entry.userName}: ${entry.summary}${entry.detail ? ` — ${entry.detail}` : ""}`);
  await appendIntegrationLog({ kind: "notify", ...entry });
}

export async function sendNotificationsForUser(
  userId: string,
  date = todayStr(),
  onlyIds?: string[],
) {
  const ha = haConfig();
  if (!ha) {
    await logNotify({ ok: false, userName: "", summary: "HA_URL or HA_TOKEN is not set" });
    return { ok: false as const, reason: "HA_URL or HA_TOKEN is not set", sent: 0, attempts: [] as NotifyAttempt[] };
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { ok: false as const, reason: "person not found", sent: 0, attempts: [] as NotifyAttempt[] };
  if (!user.haNotifyTarget) {
    await logNotify({ ok: false, userName: user.name, summary: `${user.name} has no HA notify target` });
    return { ok: false as const, reason: `${user.name} has no HA notify target`, sent: 0, attempts: [] as NotifyAttempt[] };
  }

  const assignments = await prisma.dailyAssignment.findMany({
    where: {
      userId: user.id,
      completedAt: null,
      ...(onlyIds ? { id: { in: onlyIds } } : {
        date,
        OR: [{ remindAt: null }, { remindAt: { lte: new Date() } }],
      }),
    },
    include: { task: { include: { room: true } } },
    orderBy: { order: "asc" },
  });
  if (assignments.length === 0) {
    await logNotify({ ok: false, userName: user.name, summary: `${user.name} has no open tasks on ${date}` });
    return { ok: false as const, reason: `${user.name} has no open tasks on ${date}`, sent: 0, attempts: [] as NotifyAttempt[] };
  }

  const catalog = await listHaNotifyCatalog(ha);
  if (!catalog.reachable) {
    const reason = catalog.error ?? "Home Assistant is unreachable";
    await logNotify({ ok: false, userName: user.name, summary: reason, detail: ha.url });
    return { ok: false as const, reason, sent: 0, attempts: [] as NotifyAttempt[] };
  }

  const resolved = resolveNotifyTarget(user.haNotifyTarget, catalog);
  if (!resolved.ok) {
    const reason = resolved.hint ?? `unknown notify target ${user.haNotifyTarget}`;
    await logNotify({
      ok: false,
      userName: user.name,
      summary: reason,
      detail: `stored ${user.haNotifyTarget}\nservices ${catalog.services.map((s) => `notify.${s}`).join(", ")}\nentities ${catalog.entities.join(", ")}`,
    });
    return { ok: false as const, reason, sent: 0, attempts: [] as NotifyAttempt[] };
  }

  const errors: string[] = [];
  const attempts: NotifyAttempt[] = [];
  let sent = 0;

  for (const assignment of assignments) {
    const difficulty = ["", "quick", "medium", "big job"][assignment.task.difficulty];
    const taskName = assignment.task.name;
    const base = {
      title: `${assignment.task.room.name}: ${taskName}`,
      message: `${difficulty} · tap an action below`,
    };
    // Short action ids — iOS / companion historically cap identifiers around 32 chars.
    // cuid() is 25; DONE_ + id = 30, DEFER_ + id = 31.
    const withActions = {
      ...base,
      data: {
        tag: assignment.id,
        sweepyUserId: user.id,
        action_data: { sweepyUserId: user.id },
        actions: [
          { action: `DONE_${assignment.id}`, title: "Done" },
          { action: `DEFER_${assignment.id}`, title: "Tomorrow" },
          { action: `WAIT_${assignment.id}`, title: "Later" },
        ],
      },
    };
    try {
      let result = await postNotify(ha, resolved.service, withActions);
      if (!result.ok && result.status === 400) {
        result = await postNotify(ha, resolved.service, base);
      }
      const detail = result.ok
        ? (resolved.hint ?? `notify.${resolved.service}`)
        : `${result.status} ${result.body.slice(0, 240)}`;
      const attempt: NotifyAttempt = {
        taskName,
        service: `notify.${resolved.service}`,
        url: result.url,
        ok: result.ok,
        status: result.status,
        detail,
      };
      attempts.push(attempt);
      await logNotify({
        ok: result.ok,
        userName: user.name,
        summary: result.ok ? `${taskName} → notify.${resolved.service}` : `${taskName}: HA ${result.status}`,
        detail: `${result.url}\nstored ${user.haNotifyTarget}\n${detail}`,
      });
      if (!result.ok) {
        errors.push(`${taskName}: HA ${result.status} notify.${resolved.service} ${result.body.slice(0, 160)}`);
        continue;
      }
      sent++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      attempts.push({ taskName, service: `notify.${resolved.service}`, url: "", ok: false, status: 0, detail: msg });
      await logNotify({ ok: false, userName: user.name, summary: `${taskName}: ${msg}` });
      errors.push(`${taskName}: ${msg}`);
    }
  }

  return { ok: errors.length === 0, sent, reason: errors[0] ?? resolved.hint, errors, attempts };
}

export async function sendDueReminders() {
  const due = await prisma.dailyAssignment.findMany({
    where: { completedAt: null, remindAt: { lte: new Date() } },
    select: { id: true, userId: true },
  });
  for (const a of due) {
    const result = await sendNotificationsForUser(a.userId, todayStr(), [a.id]);
    if (result.sent > 0) {
      await prisma.dailyAssignment.update({
        where: { id: a.id },
        data: { remindAt: null },
      });
    }
  }
}

export async function sendNotificationsForTime(timeStr: string) {
  const users = await prisma.user.findMany({
    where: { notifyTime: timeStr, haNotifyTarget: { not: "" } },
  });
  if (users.length === 0) return;

  const ha = haConfig();
  if (!ha) {
    console.warn("[notify] skipped — HA_URL or HA_TOKEN is not set");
    return;
  }

  for (const user of users) {
    const result = await sendNotificationsForUser(user.id);
    console.log(`[notify] ${timeStr} ${user.name}: sent ${result.sent}${result.reason ? ` (${result.reason})` : ""}`);
  }
}
