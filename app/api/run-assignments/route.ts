import { NextResponse } from "next/server";
import { dedupeOpenAssignments, runDailyAssignment } from "@/lib/scheduler";
import { prisma } from "@/lib/prisma";
import { format } from "date-fns";

// Manual trigger — clears incomplete assignments first so capacity changes are respected
export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") ?? format(new Date(), "yyyy-MM-dd");
  const isManual = searchParams.get("manual") !== "false";

  await dedupeOpenAssignments();

  if (isManual) {
    // Remove all incomplete assignments for this date so we start fresh
    await prisma.dailyAssignment.deleteMany({
      where: { date, completedAt: null },
    });
  }

  const result = await runDailyAssignment(date);
  return NextResponse.json(result);
}
