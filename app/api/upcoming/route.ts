import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { format, addDays } from "date-fns";
import { runDailyAssignment } from "@/lib/scheduler";

export async function GET() {
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, i) => format(addDays(today, i), "yyyy-MM-dd"));

  // Auto-assign any future days that have no assignments yet
  for (const date of days.slice(1)) {
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
