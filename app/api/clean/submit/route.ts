import { NextResponse } from "next/server";
import { cleanerSubmitLines } from "@/lib/cleaner";
import { completeCleanerLayer, hasCleanerAccess } from "@/lib/cleaner-db";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  if (!await hasCleanerAccess()) {
    return NextResponse.json({ error: "locked" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const lines = cleanerSubmitLines(body.lines);
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 2000) : "";
  if (lines.length === 0 && !note) {
    return NextResponse.json({ ok: false, reason: "empty" }, { status: 400 });
  }

  const saved: { taskId: string; layer: string }[] = [];
  for (const line of lines) {
    const result = await completeCleanerLayer(line.taskId, line.layer);
    if (result.ok) saved.push(line);
  }
  let noted = false;
  if (note) {
    await prisma.cleanerNote.create({ data: { body: note } });
    noted = true;
  }
  return NextResponse.json({
    ok: saved.length === lines.length,
    lines: saved,
    note: noted,
  });
}
