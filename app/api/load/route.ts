import { NextResponse } from "next/server";
import { householdLoad } from "@/lib/load";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const [tasks, people] = await Promise.all([
    prisma.task.findMany({
      where: { oneOff: false },
      select: {
        difficulty: true,
        frequencyDays: true,
        addonName: true,
        addonFrequencyDays: true,
        addonPoints: true,
      },
    }),
    prisma.user.findMany({
      select: {
        dailyCapacity: true,
        dailyTaskLimit: true,
        weekdayCapacities: true,
        weekdayTaskLimits: true,
        weekendShare: true,
        weekendCapacity: true,
        weekendTaskLimit: true,
      },
    }),
  ]);

  return NextResponse.json(householdLoad(tasks, people));
}
