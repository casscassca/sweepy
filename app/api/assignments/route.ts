import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { addTaskToDate, createOneOff, prepareAssignments } from "@/lib/scheduler";
import { COOKIE_NAME, verifySessionToken } from "@/lib/auth";
import { format } from "date-fns";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") ?? format(new Date(), "yyyy-MM-dd");
  if (searchParams.get("peek") !== "1") await prepareAssignments(date);

  const assignments = await prisma.dailyAssignment.findMany({
    where: {
      date,
      OR: [{ completedAt: null }, { task: { oneOff: false } }],
    },
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
    assignments.map(({ id, userId, order, held }: { id: string; userId: string; order: number; held?: boolean }) =>
      prisma.dailyAssignment.update({
        where: { id },
        data: { userId, order, ...(held === true && { held: true }) },
      })
    )
  );

  return NextResponse.json({ ok: true });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const day = typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date)
    ? body.date
    : format(new Date(), "yyyy-MM-dd");

  if (body.oneOff) {
    if (typeof body.name !== "string" || typeof body.userId !== "string") {
      return NextResponse.json({ ok: false, reason: "name and userId required" }, { status: 400 });
    }
    const result = await createOneOff({
      name: body.name,
      userId: body.userId,
      difficulty: Number(body.difficulty) || 1,
      date: day,
    });
    if (!result.ok) return NextResponse.json(result, { status: result.status });
    return NextResponse.json(result, { status: 201 });
  }

  if (typeof body.taskId !== "string" || !body.taskId) {
    return NextResponse.json({ ok: false, reason: "taskId required" }, { status: 400 });
  }
  const cookieStore = await cookies();
  const userId = await verifySessionToken(cookieStore.get(COOKIE_NAME)?.value);
  const result = await addTaskToDate(body.taskId, day, userId ?? undefined);
  if (!result.ok) return NextResponse.json(result, { status: result.status });
  return NextResponse.json(result);
}
