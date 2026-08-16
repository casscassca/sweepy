import { NextResponse } from "next/server";
import { prepareAssignments, reshuffleFrom, runDailyAssignment } from "@/lib/scheduler";
import { format } from "date-fns";

// Manual trigger reshuffles today and upcoming days around pins and one-offs.
export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") ?? format(new Date(), "yyyy-MM-dd");
  const isManual = searchParams.get("manual") !== "false";

  if (isManual) return NextResponse.json(await reshuffleFrom(date));

  await prepareAssignments(date);
  const result = await runDailyAssignment(date);
  return NextResponse.json(result);
}
