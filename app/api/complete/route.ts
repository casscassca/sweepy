import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const { assignmentId, completedById } = await req.json();

  const assignment = await prisma.dailyAssignment.update({
    where: { id: assignmentId },
    data: { completedAt: new Date(), completedById },
    include: { task: true },
  });

  // Update task's lastDoneAt
  await prisma.task.update({
    where: { id: assignment.taskId },
    data: { lastDoneAt: new Date() },
  });

  // Log it
  await prisma.completionLog.create({
    data: {
      taskId: assignment.taskId,
      userId: assignment.userId,
      completedById,
      completedAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true });
}

// Undo completion
export async function DELETE(req: Request) {
  const { assignmentId } = await req.json();

  await prisma.dailyAssignment.update({
    where: { id: assignmentId },
    data: { completedAt: null, completedById: null },
  });

  return NextResponse.json({ ok: true });
}
