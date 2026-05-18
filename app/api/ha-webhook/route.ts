import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { format, addDays } from "date-fns";

export async function POST(req: Request) {
  const body = await req.json();
  const action: string = body?.action ?? body?.event?.action ?? "";

  if (action.startsWith("MARK_DONE_")) {
    const assignmentId = action.replace("MARK_DONE_", "");
    const assignment = await prisma.dailyAssignment.findUnique({ where: { id: assignmentId } });
    if (!assignment) return NextResponse.json({ ok: false, reason: "not found" }, { status: 404 });
    if (assignment.completedAt) return NextResponse.json({ ok: true, alreadyDone: true });

    await prisma.dailyAssignment.update({
      where: { id: assignmentId },
      data: { completedAt: new Date(), completedById: assignment.userId },
    });
    await prisma.task.update({ where: { id: assignment.taskId }, data: { lastDoneAt: new Date() } });
    await prisma.completionLog.create({
      data: { taskId: assignment.taskId, userId: assignment.userId, completedById: assignment.userId },
    });
    return NextResponse.json({ ok: true });
  }

  if (action.startsWith("DEFER_")) {
    const assignmentId = action.replace("DEFER_", "");
    const assignment = await prisma.dailyAssignment.findUnique({ where: { id: assignmentId } });
    if (!assignment) return NextResponse.json({ ok: false, reason: "not found" }, { status: 404 });
    if (assignment.completedAt) return NextResponse.json({ ok: true, alreadyDone: true });

    const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd");

    // Move to tomorrow — if task already assigned tomorrow, just delete today's
    const exists = await prisma.dailyAssignment.findUnique({
      where: { date_taskId: { date: tomorrow, taskId: assignment.taskId } },
    });
    if (exists) {
      await prisma.dailyAssignment.delete({ where: { id: assignmentId } });
    } else {
      await prisma.dailyAssignment.update({
        where: { id: assignmentId },
        data: { date: tomorrow },
      });
    }
    return NextResponse.json({ ok: true, deferred: true });
  }

  return NextResponse.json({ ok: false, reason: "unknown action" }, { status: 400 });
}
