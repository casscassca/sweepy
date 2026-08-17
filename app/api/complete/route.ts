import { NextResponse } from "next/server";
import { completeAssignment, uncompleteAssignment } from "@/lib/complete";

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
  const date = typeof rawDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : undefined;
  const result = await completeAssignment({ assignmentId, completedById, completedAt, date });
  if (!result.ok) return NextResponse.json(result, { status: result.status });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const { assignmentId } = await req.json();
  await uncompleteAssignment(assignmentId);
  return NextResponse.json({ ok: true });
}
