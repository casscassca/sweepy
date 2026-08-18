import { format } from "date-fns";
import { prisma } from "./prisma";
import { dismissAssignmentNotify, holdAssignmentOnDate } from "./scheduler";

export async function completeAssignment(opts: {
  assignmentId: string;
  completedById?: string | null;
  completedAt: Date;
  date?: string;
}) {
  let id = opts.assignmentId;
  const current = await prisma.dailyAssignment.findUnique({ where: { id } });
  if (!current) return { ok: false as const, status: 404 as const, reason: "not found" };

  if (opts.date && opts.date !== current.date) {
    const moved = await holdAssignmentOnDate(id, opts.date);
    if (!moved) return { ok: false as const, status: 404 as const, reason: "not found" };
    id = moved.id;
  }

  const completedById = typeof opts.completedById === "string" && opts.completedById
    ? opts.completedById
    : null;

  const assignment = await prisma.dailyAssignment.update({
    where: { id },
    data: { completedAt: opts.completedAt, completedById, remindAt: null },
  });

  await prisma.task.update({
    where: { id: assignment.taskId },
    data: { lastDoneAt: opts.completedAt },
  });

  await prisma.completionLog.create({
    data: {
      taskId: assignment.taskId,
      userId: assignment.userId,
      completedById,
      completedAt: opts.completedAt,
    },
  });

  await dismissAssignmentNotify(opts.assignmentId);
  if (assignment.id !== opts.assignmentId) await dismissAssignmentNotify(assignment.id);

  return { ok: true as const, assignment };
}

export async function uncompleteFromLog(logId: string) {
  const log = await prisma.completionLog.findUnique({ where: { id: logId } });
  if (!log) return { ok: true as const };

  const latest = await prisma.completionLog.findFirst({
    where: { taskId: log.taskId },
    orderBy: [{ completedAt: "desc" }, { id: "desc" }],
  });
  const isLatest = latest?.id === log.id;

  await prisma.completionLog.delete({ where: { id: log.id } });

  if (isLatest) {
    const previous = await prisma.completionLog.findFirst({
      where: { taskId: log.taskId },
      orderBy: [{ completedAt: "desc" }, { id: "desc" }],
    });
    await prisma.task.update({
      where: { id: log.taskId },
      data: { lastDoneAt: previous?.completedAt ?? null },
    });
  }

  const date = format(log.completedAt, "yyyy-MM-dd");
  const byDate = await prisma.dailyAssignment.findUnique({
    where: { date_taskId: { date, taskId: log.taskId } },
  });
  let assignment = byDate?.completedAt ? byDate : null;
  if (!assignment) {
    const done = await prisma.dailyAssignment.findMany({
      where: { taskId: log.taskId, completedAt: { not: null } },
    });
    const doneAt = log.completedAt.getTime();
    assignment = done.find((a) => a.completedAt && Math.abs(a.completedAt.getTime() - doneAt) < 5000) ?? null;
  }
  if (assignment && isLatest) {
    await prisma.dailyAssignment.update({
      where: { id: assignment.id },
      data: { completedAt: null, completedById: null },
    });
  }

  return { ok: true as const };
}

export async function uncompleteAssignment(assignmentId: string) {
  const assignment = await prisma.dailyAssignment.findUnique({
    where: { id: assignmentId },
  });
  if (!assignment?.completedAt) return { ok: true as const };

  const logs = await prisma.completionLog.findMany({
    where: { taskId: assignment.taskId },
    orderBy: { completedAt: "desc" },
  });
  const doneAt = assignment.completedAt.getTime();
  const match = logs.find((log) => Math.abs(log.completedAt.getTime() - doneAt) < 5000) ?? logs[0];
  if (match) return uncompleteFromLog(match.id);

  await prisma.dailyAssignment.update({
    where: { id: assignmentId },
    data: { completedAt: null, completedById: null },
  });
  return { ok: true as const };
}
