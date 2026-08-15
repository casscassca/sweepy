import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { format, addDays, parseISO } from "date-fns";
import { runDailyAssignment } from "@/lib/scheduler";

function weekFrom(from: string | null): string[] {
  const start = from && /^\d{4}-\d{2}-\d{2}$/.test(from)
    ? from
    : format(new Date(), "yyyy-MM-dd");
  const noon = parseISO(`${start}T12:00:00`);
  return Array.from({ length: 7 }, (_, i) => format(addDays(noon, i), "yyyy-MM-dd"));
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const days = weekFrom(searchParams.get("from"));

  // Fill any empty day in the window, including today.
  for (const date of days) {
    const count = await prisma.dailyAssignment.count({ where: { date } });
    if (count === 0) {
      await runDailyAssignment(date);
    }
  }

  const assignments = await prisma.dailyAssignment.findMany({
    where: { date: { in: days } },
    include: {
      task: { include: { room: true, assignableUsers: { include: { user: true } } } },
      user: true,
    },
    orderBy: [{ date: "asc" }, { userId: "asc" }, { order: "asc" }],
  });

  return NextResponse.json({ days, assignments });
}
