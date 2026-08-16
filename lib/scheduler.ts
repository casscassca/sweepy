import { prisma } from "./prisma";
import { haConfig, listHaNotifyCatalog, postNotify, resolveNotifyTarget } from "./ha";
import { appendIntegrationLog } from "./integration-log";
import { DIRT_SHOW_AT, dirtinessRatio, isDirtyEnough } from "./dirtiness";
import { addDays, format, getDay, parseISO } from "date-fns";

function todayStr() {
  return format(new Date(), "yyyy-MM-dd");
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

/** Auto-scheduled rows that are still too clean come off the list. Held ones stay. */
export async function dropCleanUnheldAssignments() {
  const open = await prisma.dailyAssignment.findMany({
    where: { completedAt: null, held: false },
    include: { task: { select: { lastDoneAt: true, frequencyDays: true, oneOff: true } } },
  });
  const drop = open
    .filter((a) => !a.task.oneOff && !isDirtyEnough(a.task.lastDoneAt, a.task.frequencyDays, new Date(`${a.date}T12:00:00`)))
    .map((a) => a.id);
  if (drop.length > 0) {
    await prisma.dailyAssignment.deleteMany({ where: { id: { in: drop } } });
  }
  return drop.length;
}

/** Unfinished chores from earlier days roll to today instead of vanishing or stacking in the past. */
export async function rollForwardPastAssignments(today = todayStr()) {
  const past = await prisma.dailyAssignment.findMany({
    where: { completedAt: null, date: { lt: today } },
  });
  for (const a of past) {
    const clash = await prisma.dailyAssignment.findUnique({
      where: { date_taskId: { date: today, taskId: a.taskId } },
    });
    if (clash) await prisma.dailyAssignment.delete({ where: { id: a.id } });
    else await prisma.dailyAssignment.update({ where: { id: a.id }, data: { date: today } });
  }
  return past.length;
}

function stayRank(a: { pinned: boolean; held: boolean; task: { oneOff: boolean } }) {
  if (a.pinned) return 3;
  if (a.held && !a.task.oneOff) return 2;
  if (a.task.oneOff) return 1;
  return 0;
}

/**
 * If someone is over their daily points or task count, extras slide to the next day.
 * Auto-picks leave first, then unpinned one-offs. Pins and manually moved
 * catalog chores stay, so a day can go over capacity on purpose.
 */
export async function enforceCapacity(fromDate = todayStr(), horizon = 21) {
  const users = await prisma.user.findMany({ select: { id: true, dailyCapacity: true, dailyTaskLimit: true } });
  const cap = new Map(users.map((u) => [u.id, u.dailyCapacity]));
  const taskCap = new Map(users.map((u) => [u.id, u.dailyTaskLimit]));
  const start = parseISO(`${fromDate}T12:00:00`);

  for (let i = 0; i < horizon; i++) {
    const date = format(addDays(start, i), "yyyy-MM-dd");
    const next = format(addDays(start, i + 1), "yyyy-MM-dd");
    const open = await prisma.dailyAssignment.findMany({
      where: { date, completedAt: null },
      include: { task: { select: { difficulty: true, lastDoneAt: true, frequencyDays: true, oneOff: true } } },
    });

    const byUser = new Map<string, typeof open>();
    for (const a of open) {
      const list = byUser.get(a.userId) ?? [];
      list.push(a);
      byUser.set(a.userId, list);
    }

    for (const [userId, items] of byUser) {
      const limit = cap.get(userId) ?? 6;
      const maxTasks = taskCap.get(userId) ?? 6;
      const ranked = [...items].sort((a, b) => {
        const stay = stayRank(a) - stayRank(b);
        if (stay !== 0) return stay;
        return (
          dirtinessRatio(a.task.lastDoneAt, a.task.frequencyDays) -
          dirtinessRatio(b.task.lastDoneAt, b.task.frequencyDays)
        );
      });
      let points = items.reduce((s, a) => s + a.task.difficulty, 0);
      let count = items.length;
      let idx = 0;
      while ((points > limit || count > maxTasks) && idx < ranked.length) {
        const spill = ranked[idx++];
        if (stayRank(spill) >= 2) break;
        const clash = await prisma.dailyAssignment.findUnique({
          where: { date_taskId: { date: next, taskId: spill.taskId } },
        });
        if (clash) await prisma.dailyAssignment.delete({ where: { id: spill.id } });
        else await prisma.dailyAssignment.update({ where: { id: spill.id }, data: { date: next } });
        points -= spill.task.difficulty;
        count -= 1;
      }
    }
  }
}

/** Wipe unpinned catalog rows from today forward, then refill around pins and one-offs. */
export async function reshuffleFrom(fromDate = todayStr(), horizon = 21) {
  await prepareAssignments(fromDate);
  const start = parseISO(`${fromDate}T12:00:00`);
  const days = Array.from({ length: horizon }, (_, i) => format(addDays(start, i), "yyyy-MM-dd"));
  await prisma.dailyAssignment.deleteMany({
    where: {
      date: { in: days },
      completedAt: null,
      pinned: false,
      task: { oneOff: false },
    },
  });
  let assigned = 0;
  for (const date of days) {
    assigned += (await runDailyAssignment(date, fromDate)).assigned;
  }
  return { assigned };
}

export async function prepareAssignments(notBefore = todayStr()) {
  const duplicates = await dedupeOpenAssignments();
  const rolled = await rollForwardPastAssignments(notBefore);
  const dropped = await dropCleanUnheldAssignments();
  await enforceCapacity(notBefore);
  return { duplicates, rolled, dropped };
}

export async function holdAssignmentOnDate(id: string, date: string) {
  const current = await prisma.dailyAssignment.findUnique({ where: { id } });
  if (!current) return null;
  if (current.date !== date) {
    const clash = await prisma.dailyAssignment.findUnique({
      where: { date_taskId: { date, taskId: current.taskId } },
    });
    if (clash) {
      await prisma.dailyAssignment.delete({ where: { id } });
      await prisma.dailyAssignment.update({
        where: { id: clash.id },
        data: { held: true, remindAt: null, pinned: current.pinned || clash.pinned },
      });
      await enforceCapacity(date < todayStr() ? todayStr() : date);
      return clash;
    }
  }
  const assignment = await prisma.dailyAssignment.update({
    where: { id },
    data: { date, held: true, remindAt: null },
  });
  await enforceCapacity(date < todayStr() ? todayStr() : date);
  return assignment;
}

export async function addTaskToDate(taskId: string, date: string, preferredUserId?: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { assignableUsers: true },
  });
  if (!task) return { ok: false as const, status: 404, reason: "task not found" };
  if (task.oneOff) return { ok: false as const, status: 400, reason: "one-off" };

  const open = await prisma.dailyAssignment.findFirst({
    where: { taskId, completedAt: null },
  });
  if (open) {
    const moved = await holdAssignmentOnDate(open.id, date);
    return { ok: true as const, already: open.date === date, assignment: moved };
  }

  const existingToday = await prisma.dailyAssignment.findUnique({
    where: { date_taskId: { date, taskId } },
  });
  if (existingToday) return { ok: true as const, already: true, assignment: existingToday };

  const people = await prisma.user.findMany({ orderBy: { createdAt: "asc" }, select: { id: true } });
  const allowed = task.assignableUsers.length > 0
    ? task.assignableUsers.map((a) => a.userId)
    : people.map((u) => u.id);
  const userId = preferredUserId && allowed.includes(preferredUserId) ? preferredUserId : allowed[0];
  if (!userId) return { ok: false as const, status: 422, reason: "no people to assign to" };

  const last = await prisma.dailyAssignment.findFirst({
    where: { date, userId },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  const created = await prisma.dailyAssignment.create({
    data: { date, taskId, userId, order: (last?.order ?? -1) + 1, held: true },
  });
  await enforceCapacity(date);
  return { ok: true as const, already: false, assignment: created };
}

export async function createOneOff(opts: {
  name: string;
  userId: string;
  difficulty: number;
  date: string;
}) {
  const name = opts.name.trim();
  if (!name) return { ok: false as const, status: 400, reason: "name required" };
  const user = await prisma.user.findUnique({ where: { id: opts.userId }, select: { id: true } });
  if (!user) return { ok: false as const, status: 404, reason: "person not found" };
  const difficulty = Math.min(3, Math.max(1, Math.round(Number(opts.difficulty) || 1)));

  const last = await prisma.dailyAssignment.findFirst({
    where: { date: opts.date, userId: opts.userId },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  const task = await prisma.task.create({
    data: {
      name,
      oneOff: true,
      difficulty,
      frequencyDays: 1,
      assignments: {
        create: {
          date: opts.date,
          userId: opts.userId,
          order: (last?.order ?? -1) + 1,
          held: true,
        },
      },
    },
  });
  await enforceCapacity(opts.date);
  return { ok: true as const, taskId: task.id };
}

export async function runDailyAssignment(dateStr?: string, householdToday = todayStr()) {
  const date = dateStr ?? householdToday;
  const targetDate = new Date(date + "T12:00:00"); // noon to avoid DST edge cases
  await prepareAssignments(householdToday);

  const [tasks, users, existing, openElsewhere] = await Promise.all([
    prisma.task.findMany({
      where: { oneOff: false },
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
    .map((t) => ({
      task: t,
      dirt: dirtinessRatio(t.lastDoneAt, t.frequencyDays, targetDate),
      exclusive: t.assignableUsers.length === 1,
    }))
    .filter(({ dirt }) => dirt >= DIRT_SHOW_AT)
    .sort((a, b) => {
      if (a.exclusive !== b.exclusive) return a.exclusive ? -1 : 1;
      return b.dirt - a.dirt;
    });

  if (eligible.length === 0) return { assigned: 0 };

  const capacityLeft = new Map<string, number>(users.map((u) => [u.id, u.dailyCapacity]));
  const slotsLeft = new Map<string, number>(users.map((u) => [u.id, u.dailyTaskLimit]));
  const orderCounters = new Map<string, number>(users.map((u) => [u.id, 0]));
  for (const a of existing) {
    capacityLeft.set(a.userId, (capacityLeft.get(a.userId) ?? 0) - a.task.difficulty);
    slotsLeft.set(a.userId, (slotsLeft.get(a.userId) ?? 0) - 1);
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
      const slots = slotsLeft.get(uid) ?? 0;
      if (slots < 1 || cap < task.difficulty) continue;
      if (cap > bestCapacity) {
        bestCapacity = cap;
        bestUser = uid;
      }
    }

    if (!bestUser) continue;

    capacityLeft.set(bestUser, (capacityLeft.get(bestUser) ?? 0) - task.difficulty);
    slotsLeft.set(bestUser, (slotsLeft.get(bestUser) ?? 0) - 1);
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
      title: assignment.task.room ? `${assignment.task.room.name}: ${taskName}` : taskName,
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
