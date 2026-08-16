import { NextResponse } from "next/server";
import { sendNotificationsForUser } from "@/lib/scheduler";

export async function POST(req: Request) {
  const { userId, replace } = await req.json().catch(() => ({}));
  if (typeof userId !== "string" || !userId) {
    return NextResponse.json({ ok: false, reason: "userId required" }, { status: 400 });
  }
  const result = await sendNotificationsForUser(userId, undefined, undefined, { replace: replace !== false });
  return NextResponse.json(result, { status: result.ok ? 200 : 422 });
}
