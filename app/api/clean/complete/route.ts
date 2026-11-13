import { NextResponse } from "next/server";
import { completeCleanerLayer, hasCleanerAccess, parseCleanerLayer } from "@/lib/cleaner-db";

export async function POST(req: Request) {
  if (!await hasCleanerAccess()) {
    return NextResponse.json({ error: "locked" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const layer = parseCleanerLayer(body.layer);
  if (typeof body.taskId !== "string" || !layer) {
    return NextResponse.json({ ok: false, reason: "task and line required" }, { status: 400 });
  }
  const result = await completeCleanerLayer(body.taskId, layer);
  if (!result.ok) return NextResponse.json(result, { status: result.status });
  return NextResponse.json(result);
}
