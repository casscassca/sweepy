import { addDays, addHours, format } from "date-fns";
import { prisma } from "./prisma";
import { completeAssignment } from "./complete";
import { appendIntegrationLog } from "./integration-log";
import { fillUserTodayAndNotify, holdAssignmentOnDate } from "./scheduler";

export type NotifyActionKind = "done" | "tomorrow" | "yesterday" | "later";

export function parseNotifyAction(action: string): { kind: NotifyActionKind; assignmentId: string } | null {
  const rules: Array<{ prefix: string; kind: NotifyActionKind }> = [
    { prefix: "MARK_DONE_", kind: "done" },
    { prefix: "DONE_", kind: "done" },
    { prefix: "DEFER_", kind: "tomorrow" },
    { prefix: "YDAY_", kind: "yesterday" },
    { prefix: "YEST_", kind: "yesterday" },
    { prefix: "WAIT_", kind: "later" },
    { prefix: "LATER_", kind: "later" },
  ];
  for (const { prefix, kind } of rules) {
    if (action.startsWith(prefix)) return { kind, assignmentId: action.slice(prefix.length) };
  }
  return null;
}

export async function applyNotifyAction(opts: {
  action: string;
  actorId?: string;
  source: "webhook" | "ha-event";
}) {
  const parsed = parseNotifyAction(opts.action);
  if (!parsed) {
    await appendIntegrationLog({
      kind: "webhook",
      ok: false,
      summary: "unknown notify action",
      detail: `${opts.source}: ${opts.action || "(empty)"}`,
    });
    return { ok: false as const, status: 400, reason: "unknown action" };
  }

  const assignment = await prisma.dailyAssignment.findUnique({
    where: { id: parsed.assignmentId },
    include: { task: true, user: true },
  });
  if (!assignment) {
    await appendIntegrationLog({
      kind: "webhook",
      ok: false,
      summary: `${parsed.kind}: assignment not found`,
      detail: opts.action,
    });
    return { ok: false as const, status: 404, reason: "not found" };
  }

  const actorId = opts.actorId ?? assignment.userId;
  const actor = await prisma.user.findUnique({ where: { id: actorId } });
  const actorName = actor?.name ?? assignment.user.name;

  if (assignment.completedAt) {
    return { ok: true as const, alreadyDone: true };
  }

  if (parsed.kind === "done") {
    await completeAssignment({
      assignmentId: assignment.id,
      completedById: actorId,
      completedAt: new Date(),
    });
    await appendIntegrationLog({
      kind: "webhook",
      ok: true,
      userName: actorName,
      summary: `${actorName} marked ${assignment.task.name} done`,
      detail: opts.source,
    });
    return { ok: true as const, completedBy: actorName };
  }

  if (parsed.kind === "tomorrow") {
    const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd");
    await holdAssignmentOnDate(assignment.id, tomorrow);
    await appendIntegrationLog({
      kind: "webhook",
      ok: true,
      userName: actorName,
      summary: `${actorName} moved ${assignment.task.name} to tomorrow`,
      detail: opts.source,
    });
    return { ok: true as const, deferred: true };
  }

  if (parsed.kind === "yesterday") {
    const date = format(addDays(new Date(), -1), "yyyy-MM-dd");
    const completedAt = new Date(`${date}T12:00:00`);
    await completeAssignment({
      assignmentId: assignment.id,
      completedById: actorId,
      completedAt,
      date,
    });
    const pulled = await fillUserTodayAndNotify(assignment.userId);
    await appendIntegrationLog({
      kind: "webhook",
      ok: true,
      userName: actorName,
      summary: `${actorName} marked ${assignment.task.name} done yesterday${pulled > 0 ? ` · pulled ${pulled} more` : ""}`,
      detail: opts.source,
    });
    return { ok: true as const, yesterday: true, pulled };
  }

  const remindAt = addHours(new Date(), 1);
  await prisma.dailyAssignment.update({
    where: { id: assignment.id },
    data: { remindAt },
  });
  await appendIntegrationLog({
    kind: "webhook",
    ok: true,
    userName: actorName,
    summary: `${actorName} snoozed ${assignment.task.name} for 1 hour`,
    detail: opts.source,
  });
  return { ok: true as const, later: true, remindAt: remindAt.toISOString() };
}
