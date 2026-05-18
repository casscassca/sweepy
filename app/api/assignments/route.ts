import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { format } from "date-fns";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") ?? format(new Date(), "yyyy-MM-dd");

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
