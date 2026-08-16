import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { startOfWeek, startOfMonth, startOfYear } from "date-fns";

async function pointsSince(userId: string, since: Date) {
  const logs = await prisma.completionLog.findMany({
    where: { completedById: userId, completedAt: { gte: since } },
    select: { task: { select: { difficulty: true } } },
  });
  return logs.reduce((sum, log) => sum + log.task.difficulty, 0);
}

export async function GET() {
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const monthStart = startOfMonth(now);
  const yearStart = startOfYear(now);

  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });

  const stats = await Promise.all(
    users.map(async (user: { id: string; name: string; color: string }) => {
      const [weekly, monthly, yearly] = await Promise.all([
        pointsSince(user.id, weekStart),
        pointsSince(user.id, monthStart),
        pointsSince(user.id, yearStart),
      ]);
      return { user, weekly, monthly, yearly };
    })
  );

  return NextResponse.json(stats);
}
