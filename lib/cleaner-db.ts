import { createHmac, timingSafeEqual } from "crypto";
import { type CleanerLayer } from "./cleaner";
import { calendarDayStr, laterInstant } from "./dates";
import { COOKIE_NAME, getSessionSecret, generateWebhookSecret, SESSION_TTL_SECONDS, verifySessionToken } from "./auth";
import { dismissAssignmentNotify, holdAssignmentOnDate } from "./scheduler";
import { isFilterAddonTask, pressRfidDesiccantReset } from "./petlibro";
import { publishHaMqttTaskEvent, scheduleHaMqttSync } from "./ha-mqtt";
import { hasAddon, hasAddon2 } from "./addon";
import { prisma } from "./prisma";
import { cookies } from "next/headers";

export const CLEANER_COOKIE = "sweepy_cleaner";
export { SESSION_TTL_SECONDS };

/** The first household account. The Cleaner person the app creates is not an owner. */
export async function accountOwnerId() {
  const owner = await prisma.user.findFirst({
    where: { cleaner: false },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return owner?.id ?? null;
}

/** The Cleaner person never keeps an unfinished chore on a day. */
export async function clearOpenCleanerAssignments() {
  const removed = await prisma.dailyAssignment.deleteMany({
    where: { completedAt: null, user: { cleaner: true } },
  });
  if (removed.count > 0) scheduleHaMqttSync();
  return removed.count;
}

export async function ensureCleaner() {
  const existing = await prisma.user.findFirst({ where: { cleaner: true }, orderBy: { createdAt: "asc" } });
  if (existing) return existing;
  return prisma.user.create({
    data: {
      name: "Cleaner",
      cleaner: true,
      color: "#34d399",
      dailyCapacity: 0,
      dailyTaskLimit: 0,
      weekdayCapacities: "0,0,0,0,0,0,0",
      weekdayTaskLimits: "0,0,0,0,0,0,0",
      weekendShare: false,
      weekendCapacity: 0,
      weekendTaskLimit: 0,
      notifyTime: "",
      haNotifyTarget: "",
      webhookSecret: generateWebhookSecret(),
    },
  });
}

export async function createCleanerToken(): Promise<string> {
  const secret = await getSessionSecret();
  const exp = Date.now() + SESSION_TTL_SECONDS * 1000;
  const payload = Buffer.from(JSON.stringify({ kind: "cleaner", exp })).toString("base64url");
  const sig = createHmac("sha256", secret).update(`cleaner:${payload}`).digest("base64url");
  return `${payload}.${sig}`;
}

export async function verifyCleanerToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  const secret = await getSessionSecret();
  const expected = createHmac("sha256", secret).update(`cleaner:${payload}`).digest("base64url");
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as { kind?: string; exp?: number };
    return data.kind === "cleaner" && typeof data.exp === "number" && Date.now() <= data.exp;
  } catch {
    return false;
  }
}

export async function hasCleanerAccess() {
  const jar = await cookies();
  if (await verifyCleanerToken(jar.get(CLEANER_COOKIE)?.value)) return true;
  const userId = await verifySessionToken(jar.get(COOKIE_NAME)?.value);
  return Boolean(userId);
}

export async function completeCleanerLayer(taskId: string, layer: CleanerLayer) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task || task.oneOff || task.hideFromCleaner) {
    return { ok: false as const, status: 404 as const, reason: "not found" };
  }
  if (layer === "addon" && !hasAddon(task)) return { ok: false as const, status: 400 as const, reason: "no add-on" };
  if (layer === "addon2" && !hasAddon2(task)) return { ok: false as const, status: 400 as const, reason: "no add-on" };

  const cleaner = await ensureCleaner();
  const completedAt = new Date();

  if (layer === "base") {
    await prisma.task.update({
      where: { id: task.id },
      data: { lastDoneAt: laterInstant(task.lastDoneAt, completedAt) },
    });
    const open = await prisma.dailyAssignment.findFirst({
      where: { taskId: task.id, completedAt: null },
    });
    if (open) {
      const today = calendarDayStr(completedAt);
      const moved = open.date === today
        ? open
        : await holdAssignmentOnDate(open.id, today, { respectAllowed: false });
      if (moved) {
        await prisma.dailyAssignment.update({
          where: { id: moved.id },
          data: {
            completedAt,
            completedById: cleaner.id,
            userId: cleaner.id,
            remindAt: null,
          },
        });
        void dismissAssignmentNotify(moved.id);
        if (moved.id !== open.id) void dismissAssignmentNotify(open.id);
      }
    }
    void publishHaMqttTaskEvent({
      kind: "completed",
      taskId: task.id,
      completedAt,
      userId: cleaner.id,
      completedById: cleaner.id,
    });
  } else if (layer === "addon") {
    await prisma.task.update({
      where: { id: task.id },
      data: { addonLastDoneAt: laterInstant(task.addonLastDoneAt, completedAt) },
    });
  } else {
    await prisma.task.update({
      where: { id: task.id },
      data: { addon2LastDoneAt: laterInstant(task.addon2LastDoneAt, completedAt) },
    });
    if (isFilterAddonTask(task)) void pressRfidDesiccantReset();
  }

  await prisma.completionLog.create({
    data: {
      taskId: task.id,
      userId: cleaner.id,
      completedById: cleaner.id,
      completedAt,
      layer,
    },
  });
  scheduleHaMqttSync();
  return { ok: true as const };
}

export function parseCleanerLayer(raw: unknown): CleanerLayer | null {
  if (raw === "base" || raw === "addon" || raw === "addon2") return raw;
  return null;
}
