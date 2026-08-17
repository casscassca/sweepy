import { prisma } from "./prisma";
import { holdAssignmentOnDate } from "./scheduler";

export async function completeAssignment(opts: {
  assignmentId: string;
  completedById: string;
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

  const assignment = await prisma.dailyAssignment.update({
    where: { id },
    data: { completedAt: opts.completedAt, completedById: opts.completedById, remindAt: null },
  });

  await prisma.task.update({
    where: { id: assignment.taskId },
    data: { lastDoneAt: opts.completedAt },
  });

  await prisma.completionLog.create({
    data: {
      taskId: assignment.taskId,
      userId: assignment.userId,
      completedById: opts.completedById,
      completedAt: opts.completedAt,
    },
  });

  return { ok: true as const, assignment };
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
  if (match) {
    await prisma.completionLog.delete({ where: { id: match.id } });
  }

  const previous = await prisma.completionLog.findFirst({
    where: { taskId: assignment.taskId },
    orderBy: { completedAt: "desc" },
  });

  await prisma.task.update({
    where: { id: assignment.taskId },
    data: { lastDoneAt: previous?.completedAt ?? null },
  });

  await prisma.dailyAssignment.update({
    where: { id: assignmentId },
    data: { completedAt: null, completedById: null },
  });

  return { ok: true as const };
}
