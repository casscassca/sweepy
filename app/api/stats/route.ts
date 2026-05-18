import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { startOfWeek, startOfMonth, startOfYear } from "date-fns";

export async function GET() {
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const monthStart = startOfMonth(now);
  const yearStart = startOfYear(now);

  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });

  const stats = await Promise.all(
    users.map(async (user: { id: string; name: string; color: string }) => {
      const [weekly, monthly, yearly] = await Promise.all([
        prisma.completionLog.count({
          where: { completedById: user.id, completedAt: { gte: weekStart } },
        }),
        prisma.completionLog.count({
          where: { completedById: user.id, completedAt: { gte: monthStart } },
        }),
        prisma.completionLog.count({
          where: { completedById: user.id, completedAt: { gte: yearStart } },
        }),
      ]);
      return { user, weekly, monthly, yearly };
    })
  );

  return NextResponse.json(stats);
}
