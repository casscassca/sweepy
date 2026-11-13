import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { startOfWeek, startOfMonth, startOfYear } from "date-fns";
import { calendarDayStr } from "@/lib/dates";
import { cleanerLayerPoints, cleanerVisitSummary } from "@/lib/cleaner-points";

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

  const users = await prisma.user.findMany({
    where: { cleaner: false },
    orderBy: { createdAt: "asc" },
  });

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

  const cleaner = await prisma.user.findFirst({ where: { cleaner: true }, select: { id: true } });
  let cleanerSummary = null;
  if (cleaner) {
    const logs = await prisma.completionLog.findMany({
      where: { completedById: cleaner.id },
      select: {
        completedAt: true,
        layer: true,
        task: { select: { difficulty: true, addonPoints: true, addon2Points: true } },
      },
    });
    cleanerSummary = cleanerVisitSummary(
      logs.map((log) => ({
        completedAt: log.completedAt,
        points: cleanerLayerPoints({
          layer: log.layer,
          difficulty: log.task.difficulty,
          addonPoints: log.task.addonPoints,
          addon2Points: log.task.addon2Points,
        }),
      })),
      calendarDayStr(),
    );
  }

  return NextResponse.json({ people: stats, cleaner: cleanerSummary });
}
