import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { format, addDays } from "date-fns";

// This endpoint is NOT behind the browser login (Home Assistant has no cookie).
// Instead, every call must carry a per-user webhook secret, which both
// authorizes the request and identifies who acted. Send it either as the
// `x-webhook-secret` header or a `secret` field in the JSON body.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const token = req.headers.get("x-webhook-secret") ?? body?.secret ?? "";

  if (!token) {
    return NextResponse.json({ ok: false, reason: "missing secret" }, { status: 401 });
  }
  const actor = await prisma.user.findFirst({ where: { webhookSecret: String(token) } });
  if (!actor) {
    return NextResponse.json({ ok: false, reason: "invalid secret" }, { status: 401 });
  }

  const action: string = body?.action ?? body?.event?.action ?? "";

  if (action.startsWith("MARK_DONE_")) {
    const assignmentId = action.replace("MARK_DONE_", "");
    const assignment = await prisma.dailyAssignment.findUnique({ where: { id: assignmentId } });
    if (!assignment) return NextResponse.json({ ok: false, reason: "not found" }, { status: 404 });
    if (assignment.completedAt) return NextResponse.json({ ok: true, alreadyDone: true });

    // Credit the person who pressed the button (the token's owner), not the assignee.
    await prisma.dailyAssignment.update({
      where: { id: assignmentId },
      data: { completedAt: new Date(), completedById: actor.id },
    });
    await prisma.task.update({ where: { id: assignment.taskId }, data: { lastDoneAt: new Date() } });
    await prisma.completionLog.create({
      data: { taskId: assignment.taskId, userId: assignment.userId, completedById: actor.id },
    });
    return NextResponse.json({ ok: true, completedBy: actor.name });
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
