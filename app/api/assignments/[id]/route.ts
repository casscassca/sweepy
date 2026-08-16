import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { holdAssignmentOnDate } from "@/lib/scheduler";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const assignment = await prisma.dailyAssignment.findUnique({
    where: { id },
    include: { task: { select: { oneOff: true, id: true } } },
  });
  if (!assignment) return NextResponse.json({ ok: true });
  await prisma.dailyAssignment.delete({ where: { id } });
  if (assignment.task.oneOff) {
    const logs = await prisma.completionLog.count({ where: { taskId: assignment.task.id } });
    if (logs === 0) await prisma.task.delete({ where: { id: assignment.task.id } });
  }
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { date, userId, order } = await req.json();

  if (typeof date === "string") {
    const assignment = await holdAssignmentOnDate(id, date);
    if (!assignment) return NextResponse.json({ ok: false, reason: "not found" }, { status: 404 });
    if (typeof userId === "string" || typeof order === "number") {
      return NextResponse.json(await prisma.dailyAssignment.update({
        where: { id: assignment.id },
        data: {
          ...(typeof userId === "string" && { userId }),
          ...(typeof order === "number" && { order }),
        },
      }));
    }
    return NextResponse.json(assignment);
  }

  const assignment = await prisma.dailyAssignment.update({
    where: { id },
    data: {
      ...(userId !== undefined && { userId }),
      ...(order !== undefined && { order }),
    },
  });
  return NextResponse.json(assignment);
}
