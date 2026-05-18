import { NextResponse } from "next/server";
import { runDailyAssignment } from "@/lib/scheduler";

// Manual trigger or cron trigger
export async function POST() {
  const result = await runDailyAssignment();
  return NextResponse.json(result);
}
