import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function completedAtFrom(raw: unknown) {
  if (typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const noon = new Date(`${raw}T12:00:00`);
    const todayNoon = new Date();
    todayNoon.setHours(12, 0, 0, 0);
    if (!Number.isNaN(noon.getTime()) && noon <= todayNoon) return noon;
  }
  return new Date();
}

export async function POST(req: Request) {
  const { assignmentId, completedById, completedAt: rawDate } = await req.json();
  const completedAt = completedAtFrom(rawDate);

  const assignment = await prisma.dailyAssignment.update({
    where: { id: assignmentId },
    data: { completedAt, completedById },
    include: { task: true },
  });

  await prisma.task.update({
    where: { id: assignment.taskId },
    data: { lastDoneAt: completedAt },
  });

  await prisma.completionLog.create({
    data: {
      taskId: assignment.taskId,
      userId: assignment.userId,
      completedById,
      completedAt,
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
