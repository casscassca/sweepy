import { prisma } from "./prisma";
import { haConfig, listHaNotifyCatalog, postNotify, resolveNotifyTarget } from "./ha";
import { appendIntegrationLog } from "./integration-log";
import { displayTaskDifficulty, displayTaskName, isTaskEligible } from "./addon";
import { dirtinessRatio, dueDayStr } from "./dirtiness";
import { calendarDayStr } from "./dates";
import { addDays, format, getDay, parseISO } from "date-fns";

function todayStr() {
  return calendarDayStr(new Date());
}

// allowedDays is a comma-separated string of day numbers (0=Sun … 6=Sat), or null = any day
function isAllowedOnDate(allowedDays: string | null, date: Date): boolean {
  if (!allowedDays) return true;
  const allowed = allowedDays.split(",").map(Number);
  return allowed.includes(getDay(date));
}

function nextAllowedOnOrAfter(allowedDays: string | null, from: string, until: string): string | null {
  let day = parseISO(`${from}T12:00:00`);
  const end = parseISO(`${until}T12:00:00`);
  while (day <= end) {
    if (isAllowedOnDate(allowedDays, day)) return format(day, "yyyy-MM-dd");
    day = addDays(day, 1);
  }
  return null;
}

function dueOnlyTargetDate(
  lastDoneAt: Date | string | null,
  frequencyDays: number,
  allowedDays: string | null,
  fromDate: string,
  until: string,
) {
  const due = dueDayStr(lastDoneAt, frequencyDays);
  const start = !due || due < fromDate ? fromDate : due;
  return nextAllowedOnOrAfter(allowedDays, start, until);
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
    include: { task: { select: { lastDoneAt: true, frequencyDays: true, oneOff: true, dueOnly: true, addonName: true, addonFrequencyDays: true, addonPoints: true, addonLastDoneAt: true } } },
  });
  const drop = open
    .filter((a) => !a.task.oneOff && !isTaskEligible(a.task, new Date(`${a.date}T12:00:00`)))
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

function isManualStay(a: { pinned: boolean; held: boolean; task: { oneOff: boolean } }) {
  return a.pinned || a.held || a.task.oneOff;
}

function staysOnItsDay(a: { pinned: boolean; held: boolean; task: { oneOff: boolean; dueOnly?: boolean } }) {
  return isManualStay(a) || !!a.task.dueOnly;
}

/**
 * Auto-picks that overflow a person's daily points or task count slide forward.
 * Regular chores go first (cleanest first). Important autos only slide if
 * nothing else can. Pins, one-offs, due-only chores, and anything placed
 * by hand stay put and do not push other chores off the day — a day can
 * go over capacity on purpose.
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
      include: { task: { select: { difficulty: true, lastDoneAt: true, frequencyDays: true, oneOff: true, important: true, dueOnly: true, addonName: true, addonFrequencyDays: true, addonPoints: true, addonLastDoneAt: true } } },
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
      const autos = items.filter((a) => !staysOnItsDay(a));
      const ranked = [...autos].sort((a, b) => {
        if (a.task.important !== b.task.important) return a.task.important ? 1 : -1;
        return dirtinessRatio(a.task.lastDoneAt, a.task.frequencyDays) -
          dirtinessRatio(b.task.lastDoneAt, b.task.frequencyDays);
      });
      const asOf = new Date(`${date}T12:00:00`);
      let points = autos.reduce((s, a) => s + displayTaskDifficulty(a.task, asOf), 0);
      let count = autos.length;
      let idx = 0;
      while ((points > limit || count > maxTasks) && idx < ranked.length) {
        const spill = ranked[idx++];
        const clash = await prisma.dailyAssignment.findUnique({
          where: { date_taskId: { date: next, taskId: spill.taskId } },
        });
        if (clash) await prisma.dailyAssignment.delete({ where: { id: spill.id } });
        else await prisma.dailyAssignment.update({ where: { id: spill.id }, data: { date: next } });
        points -= displayTaskDifficulty(spill.task, asOf);
        count -= 1;
      }
    }
  }
}

/** Wipe auto catalog rows from today forward, then refill around what should stay. */
export async function reshuffleFrom(
  fromDate = todayStr(),
  horizon = 21,
  opts?: { keepHeld?: boolean },
) {
  await prepareAssignments(fromDate);
  const start = parseISO(`${fromDate}T12:00:00`);
  const days = Array.from({ length: horizon }, (_, i) => format(addDays(start, i), "yyyy-MM-dd"));
  await prisma.dailyAssignment.deleteMany({
    where: {
      date: { in: days },
      completedAt: null,
      pinned: false,
      ...(opts?.keepHeld ? { held: false } : {}),
      task: { oneOff: false },
    },
  });
  // Plant due-only chores on their real due day first so leftover capacity
  // on later days cannot steal them.
  await placeDueOnlyOnDueDays(fromDate, horizon);
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
  await snapDueOnlyToDueDay(notBefore);
  await enforceCapacity(notBefore);
  return { duplicates, rolled, dropped };
}

/** Move unheld due-only chores onto the day the interval is actually up. */
async function snapDueOnlyToDueDay(fromDate = todayStr(), horizon = 21) {
  const until = format(addDays(parseISO(`${fromDate}T12:00:00`), horizon - 1), "yyyy-MM-dd");
  const open = await prisma.dailyAssignment.findMany({
    where: { completedAt: null, pinned: false, held: false, task: { dueOnly: true, oneOff: false } },
    include: { task: { select: { lastDoneAt: true, frequencyDays: true, allowedDays: true } } },
  });
  for (const a of open) {
    const target = dueOnlyTargetDate(a.task.lastDoneAt, a.task.frequencyDays, a.task.allowedDays, fromDate, until);
    if (!target || target === a.date) continue;
    const clash = await prisma.dailyAssignment.findUnique({
      where: { date_taskId: { date: target, taskId: a.taskId } },
    });
    if (clash) await prisma.dailyAssignment.delete({ where: { id: a.id } });
    else await prisma.dailyAssignment.update({ where: { id: a.id }, data: { date: target } });
  }
}

/** After a reshuffle wipe, seat due-only chores on their due day before filler runs. */
async function placeDueOnlyOnDueDays(fromDate: string, horizon: number) {
  const until = format(addDays(parseISO(`${fromDate}T12:00:00`), horizon - 1), "yyyy-MM-dd");
  const [tasks, users, open] = await Promise.all([
    prisma.task.findMany({
      where: { dueOnly: true, oneOff: false },
      include: { assignableUsers: true },
    }),
    prisma.user.findMany({ orderBy: { createdAt: "asc" }, select: { id: true } }),
    prisma.dailyAssignment.findMany({
      where: { completedAt: null },
      select: { taskId: true, date: true, userId: true, order: true },
    }),
  ]);

  const taken = new Set(open.map((a) => a.taskId));
  const load = new Map<string, number>();
  const lastOrder = new Map<string, number>();
  for (const a of open) {
    const userKey = `${a.date}:${a.userId}`;
    load.set(userKey, (load.get(userKey) ?? 0) + 1);
    lastOrder.set(userKey, Math.max(lastOrder.get(userKey) ?? -1, a.order));
  }

  const toCreate: Array<{ date: string; userId: string; taskId: string; order: number }> = [];
  for (const task of tasks) {
    if (taken.has(task.id)) continue;
    const date = dueOnlyTargetDate(task.lastDoneAt, task.frequencyDays, task.allowedDays, fromDate, until);
    if (!date) continue;

    const allowed = task.assignableUsers.length > 0
      ? task.assignableUsers.map((au) => au.userId)
      : users.map((u) => u.id);
    if (allowed.length === 0) continue;

    let bestUser = allowed[0];
    let bestLoad = Number.POSITIVE_INFINITY;
    for (const uid of allowed) {
      const n = load.get(`${date}:${uid}`) ?? 0;
      if (n < bestLoad) {
        bestLoad = n;
        bestUser = uid;
      }
    }

    const userKey = `${date}:${bestUser}`;
    const order = (lastOrder.get(userKey) ?? -1) + 1;
    lastOrder.set(userKey, order);
    load.set(userKey, (load.get(userKey) ?? 0) + 1);
    taken.add(task.id);
    toCreate.push({ date, userId: bestUser, taskId: task.id, order });
  }

  if (toCreate.length > 0) {
    await prisma.dailyAssignment.createMany({ data: toCreate });
  }
  return toCreate.length;
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
      return clash;
    }
  }
  const assignment = await prisma.dailyAssignment.update({
    where: { id },
    data: { date, held: true, remindAt: null },
  });
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
      include: { task: { select: { difficulty: true, lastDoneAt: true, frequencyDays: true, dueOnly: true, addonName: true, addonFrequencyDays: true, addonPoints: true, addonLastDoneAt: true } } },
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
      important: t.important,
    }))
    .filter(({ task }) => isTaskEligible(task, targetDate))
    .sort((a, b) => {
      if (a.important !== b.important) return a.important ? -1 : 1;
      if (a.exclusive !== b.exclusive) return a.exclusive ? -1 : 1;
      return b.dirt - a.dirt;
    });

  if (eligible.length === 0) return { assigned: 0 };

  const capacityLeft = new Map<string, number>(users.map((u) => [u.id, u.dailyCapacity]));
  const slotsLeft = new Map<string, number>(users.map((u) => [u.id, u.dailyTaskLimit]));
  const orderCounters = new Map<string, number>(users.map((u) => [u.id, 0]));
  for (const a of existing) {
    capacityLeft.set(a.userId, (capacityLeft.get(a.userId) ?? 0) - displayTaskDifficulty(a.task, targetDate));
    slotsLeft.set(a.userId, (slotsLeft.get(a.userId) ?? 0) - 1);
    orderCounters.set(a.userId, (orderCounters.get(a.userId) ?? 0) + 1);
  }

  const toCreate: Array<{ date: string; userId: string; taskId: string; order: number }> = [];

  const pickUser = (task: (typeof eligible)[number]["task"], allowOver: boolean) => {
    const assignableUserIds =
      task.assignableUsers.length > 0
        ? task.assignableUsers.map((au: { userId: string }) => au.userId)
        : users.map((u) => u.id);

    let bestUser: string | null = null;
    let bestCapacity = allowOver ? Number.NEGATIVE_INFINITY : -1;
    for (const uid of assignableUserIds) {
      const cap = capacityLeft.get(uid) ?? 0;
      const slots = slotsLeft.get(uid) ?? 0;
      if (!allowOver && (slots < 1 || cap < displayTaskDifficulty(task, targetDate))) continue;
      if (cap > bestCapacity) {
        bestCapacity = cap;
        bestUser = uid;
      }
    }
    return bestUser;
  };

  const place = (items: typeof eligible, allowOver: boolean) => {
    for (const { task } of items) {
      const bestUser = pickUser(task, allowOver);
      if (!bestUser) continue;

      capacityLeft.set(bestUser, (capacityLeft.get(bestUser) ?? 0) - displayTaskDifficulty(task, targetDate));
      slotsLeft.set(bestUser, (slotsLeft.get(bestUser) ?? 0) - 1);
      const order = orderCounters.get(bestUser) ?? 0;
      orderCounters.set(bestUser, order + 1);
      toCreate.push({ date, userId: bestUser, taskId: task.id, order });
    }
  };

  // Due-only chores get their actual due day, even if that day is already full.
  place(eligible.filter((e) => e.task.dueOnly), true);
  place(eligible.filter((e) => !e.task.dueOnly), false);

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

function parseNotifyTags(raw: string | null | undefined) {
  return (raw ?? "").split(",").map((t) => t.trim()).filter(Boolean);
}

/** Ask HA to drop this assignment's banner on whoever still has the tag. */
export async function dismissAssignmentNotify(assignmentId: string) {
  try {
    const assignment = await prisma.dailyAssignment.findUnique({
      where: { id: assignmentId },
      select: { id: true, taskId: true, userId: true },
    });
    if (!assignment) return;
    const ha = haConfig();
    if (!ha) return;

    const people = await prisma.user.findMany({
      where: { haNotifyTarget: { not: "" } },
      select: { id: true, haNotifyTarget: true, notifyTags: true },
    });
    const drop = [assignment.id, assignment.taskId];
    const targets = people.filter((user) => {
      const tags = parseNotifyTags(user.notifyTags);
      return user.id === assignment.userId || drop.some((tag) => tags.includes(tag));
    });
    if (targets.length === 0) return;

    const catalog = await listHaNotifyCatalog(ha);
    if (!catalog.reachable) return;

    for (const user of targets) {
      const resolved = resolveNotifyTarget(user.haNotifyTarget, catalog);
      if (!resolved.ok) continue;
      await clearPhoneNotifications(ha, resolved.service, drop);
      const next = parseNotifyTags(user.notifyTags).filter((tag) => !drop.includes(tag));
      await prisma.user.update({ where: { id: user.id }, data: { notifyTags: next.join(",") } });
    }
  } catch (err) {
    console.error("[notify] dismiss failed", err);
  }
}

async function clearPhoneNotifications(
  ha: NonNullable<ReturnType<typeof haConfig>>,
  service: string,
  tags: string[],
) {
  const unique = [...new Set(tags)];
  for (const tag of unique) {
    await postNotify(ha, service, {
      message: "clear_notification",
      data: { tag },
    });
  }
  return unique.length;
}

export async function sendNotificationsForUser(
  userId: string,
  date = todayStr(),
  onlyIds?: string[],
  opts?: { replace?: boolean },
) {
  const replace = opts?.replace === true;
  const ha = haConfig();
  if (!ha) {
    await logNotify({ ok: false, userName: "", summary: "HA_URL or HA_TOKEN is not set" });
    return { ok: false as const, reason: "HA_URL or HA_TOKEN is not set", sent: 0, cleared: 0, attempts: [] as NotifyAttempt[] };
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { ok: false as const, reason: "person not found", sent: 0, cleared: 0, attempts: [] as NotifyAttempt[] };
  if (!user.haNotifyTarget) {
    await logNotify({ ok: false, userName: user.name, summary: `${user.name} has no HA notify target` });
    return { ok: false as const, reason: `${user.name} has no HA notify target`, sent: 0, cleared: 0, attempts: [] as NotifyAttempt[] };
  }

  const catalog = await listHaNotifyCatalog(ha);
  if (!catalog.reachable) {
    const reason = catalog.error ?? "Home Assistant is unreachable";
    await logNotify({ ok: false, userName: user.name, summary: reason, detail: ha.url });
    return { ok: false as const, reason, sent: 0, cleared: 0, attempts: [] as NotifyAttempt[] };
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
    return { ok: false as const, reason, sent: 0, cleared: 0, attempts: [] as NotifyAttempt[] };
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
  assignments.sort((a, b) => {
    const aImp = a.task.important ? 1 : 0;
    const bImp = b.task.important ? 1 : 0;
    if (aImp !== bImp) return bImp - aImp;
    return a.order - b.order;
  });

  // iOS rarely honors clear_notification (the app has to wake). Same-tag
  // replace is what actually updates a banner. Keep assignment.id as the tag
  // so a resend overwrites this morning's notifies instead of stacking.
  let cleared = 0;
  if (replace) {
    const keep = new Set(assignments.map((a) => a.id));
    const leftovers = [
      ...parseNotifyTags(user.notifyTags),
      ...assignments.map((a) => a.taskId),
    ].filter((tag) => !keep.has(tag));
    cleared = await clearPhoneNotifications(ha, resolved.service, leftovers);
    if (cleared > 0) {
      await logNotify({
        ok: true,
        userName: user.name,
        summary: `asked HA to dismiss ${cleared} leftover notify tag${cleared === 1 ? "" : "s"} for ${user.name}`,
      });
    }
  }

  if (assignments.length === 0) {
    if (replace) {
      await prisma.user.update({ where: { id: user.id }, data: { notifyTags: "" } });
      await logNotify({ ok: true, userName: user.name, summary: `cleared ${user.name}'s notifies — nothing on ${date}` });
      return { ok: true as const, sent: 0, cleared, reason: `cleared ${user.name}'s notifies — nothing on today's list`, attempts: [] as NotifyAttempt[] };
    }
    await logNotify({ ok: false, userName: user.name, summary: `${user.name} has no open tasks on ${date}` });
    return { ok: false as const, reason: `${user.name} has no open tasks on ${date}`, sent: 0, cleared, attempts: [] as NotifyAttempt[] };
  }

  const errors: string[] = [];
  const attempts: NotifyAttempt[] = [];
  let sent = 0;
  const sentIds: string[] = [];

  for (const assignment of assignments) {
    const difficulty = ["", "quick", "medium", "big job"][displayTaskDifficulty(assignment.task)];
    const taskName = displayTaskName(assignment.task);
    const tag = assignment.id;
    const base = {
      title: assignment.task.room ? `${assignment.task.room.name}: ${taskName}` : taskName,
      message: `${difficulty} · tap an action below`,
    };
    // Short action ids — iOS / companion historically cap identifiers around 32 chars.
    // cuid() is 25; DONE_ + id = 30, DEFER_ + id = 31, YDAY_ + id = 30.
    const withActions = {
      ...base,
      data: {
        tag,
        apns_headers: { "apns-collapse-id": tag },
        sweepyUserId: user.id,
        action_data: { sweepyUserId: user.id },
        actions: [
          { action: `DONE_${assignment.id}`, title: "Done" },
          { action: `DEFER_${assignment.id}`, title: "Tomorrow" },
          { action: `YDAY_${assignment.id}`, title: "Yesterday" },
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
      sentIds.push(assignment.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      attempts.push({ taskName, service: `notify.${resolved.service}`, url: "", ok: false, status: 0, detail: msg });
      await logNotify({ ok: false, userName: user.name, summary: `${taskName}: ${msg}` });
      errors.push(`${taskName}: ${msg}`);
    }
  }

  const previous = parseNotifyTags(user.notifyTags);
  const nextTags = onlyIds && !replace
    ? [...new Set([...previous, ...sentIds])]
    : sentIds;
  await prisma.user.update({ where: { id: user.id }, data: { notifyTags: nextTags.join(",") } });

  return { ok: errors.length === 0, sent, cleared, reason: errors[0] ?? resolved.hint, errors, attempts };
}

/** If this person is still under today's cap, add the next due chore and ping them. */
export async function fillUserTodayAndNotify(userId: string) {
  const date = todayStr();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, dailyCapacity: true, dailyTaskLimit: true },
  });
  if (!user) return 0;

  const open = await prisma.dailyAssignment.findMany({
    where: { userId, date, completedAt: null },
    include: { task: { select: { difficulty: true, lastDoneAt: true, frequencyDays: true, dueOnly: true, addonName: true, addonFrequencyDays: true, addonPoints: true, addonLastDoneAt: true } } },
  });
  const asOf = new Date(`${date}T12:00:00`);
  const points = open.reduce((s, a) => s + displayTaskDifficulty(a.task, asOf), 0);
  if (open.length >= user.dailyTaskLimit || points >= user.dailyCapacity) return 0;

  const addedId = await assignNextForUser(user.id, date, user.dailyCapacity - points);
  if (!addedId) return 0;
  await sendNotificationsForUser(userId, date, [addedId]);
  return 1;
}

async function assignNextForUser(userId: string, date: string, pointsLeft: number) {
  const targetDate = new Date(`${date}T12:00:00`);
  const [tasks, existing, openElsewhere] = await Promise.all([
    prisma.task.findMany({
      where: { oneOff: false },
      include: { assignableUsers: true },
    }),
    prisma.dailyAssignment.findMany({
      where: { date },
      select: { taskId: true, userId: true, order: true },
    }),
    prisma.dailyAssignment.findMany({
      where: { completedAt: null, date: { not: date } },
      select: { taskId: true },
    }),
  ]);
  const taken = new Set(existing.map((a) => a.taskId));
  const blocked = new Set(openElsewhere.map((a) => a.taskId));
  const lastOrder = existing
    .filter((a) => a.userId === userId)
    .reduce((max, a) => Math.max(max, a.order), -1);

  const next = tasks
    .filter((t) => !taken.has(t.id) && !blocked.has(t.id))
    .filter((t) => isAllowedOnDate(t.allowedDays, targetDate))
    .filter((t) => t.assignableUsers.length === 0 || t.assignableUsers.some((au) => au.userId === userId))
    .map((t) => ({
      task: t,
      dirt: dirtinessRatio(t.lastDoneAt, t.frequencyDays, targetDate),
      exclusive: t.assignableUsers.length === 1,
    }))
    .filter(({ task }) => isTaskEligible(task, targetDate) && displayTaskDifficulty(task, targetDate) <= pointsLeft)
    .sort((a, b) => {
      if (a.task.dueOnly !== b.task.dueOnly) return a.task.dueOnly ? -1 : 1;
      if (a.task.important !== b.task.important) return a.task.important ? -1 : 1;
      if (a.exclusive !== b.exclusive) return a.exclusive ? -1 : 1;
      return b.dirt - a.dirt;
    })[0];

  if (!next) return null;
  const created = await prisma.dailyAssignment.create({
    data: { date, userId, taskId: next.task.id, order: lastOrder + 1 },
  });
  return created.id;
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
