import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { addTaskToDate, prepareAssignments } from "@/lib/scheduler";
import { COOKIE_NAME, verifySessionToken } from "@/lib/auth";
import { format } from "date-fns";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") ?? format(new Date(), "yyyy-MM-dd");
  if (searchParams.get("peek") !== "1") await prepareAssignments(date);

  const assignments = await prisma.dailyAssignment.findMany({
    where: { date },
    include: {
      task: { include: { room: true } },
      user: true,
    },
    orderBy: [{ userId: "asc" }, { order: "asc" }],
  });

  return NextResponse.json(assignments);
}

// Reorder or reassign
export async function PATCH(req: Request) {
  const { assignments } = await req.json();
  // assignments: Array<{ id: string, userId: string, order: number }>

  await Promise.all(
    assignments.map(({ id, userId, order }: { id: string; userId: string; order: number }) =>
      prisma.dailyAssignment.update({ where: { id }, data: { userId, order } })
    )
  );

  return NextResponse.json({ ok: true });
}

export async function POST(req: Request) {
  const { taskId, date } = await req.json().catch(() => ({}));
  if (typeof taskId !== "string" || !taskId) {
    return NextResponse.json({ ok: false, reason: "taskId required" }, { status: 400 });
  }
  const cookieStore = await cookies();
  const userId = await verifySessionToken(cookieStore.get(COOKIE_NAME)?.value);
  const day = typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? date
    : format(new Date(), "yyyy-MM-dd");
  const result = await addTaskToDate(taskId, day, userId ?? undefined);
  if (!result.ok) return NextResponse.json(result, { status: result.status });
  return NextResponse.json(result);
}
