import { NextResponse } from "next/server";
import { completeAssignment, completeTask, uncompleteAssignment, uncompleteTask } from "@/lib/complete";

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
  const { assignmentId, taskId, completedById, completedAt: rawDate } = await req.json();
  const completedAt = completedAtFrom(rawDate);
  const date = typeof rawDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : undefined;
  const by = typeof completedById === "string" && completedById ? completedById : null;
  const result = typeof assignmentId === "string" && assignmentId
    ? await completeAssignment({ assignmentId, completedById: by, completedAt, date })
    : typeof taskId === "string" && taskId
      ? await completeTask({ taskId, completedById: by, completedAt, date })
      : { ok: false as const, status: 400 as const, reason: "taskId or assignmentId required" };
  if (!result.ok) return NextResponse.json(result, { status: result.status });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const { assignmentId, taskId } = await req.json();
  if (typeof assignmentId === "string" && assignmentId) await uncompleteAssignment(assignmentId);
  else if (typeof taskId === "string" && taskId) await uncompleteTask(taskId);
  return NextResponse.json({ ok: true });
}
