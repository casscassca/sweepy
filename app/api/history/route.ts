import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { uncompleteFromLog } from "@/lib/complete";
import { COOKIE_NAME, verifySessionToken } from "@/lib/auth";
import { accountOwnerId } from "@/lib/cleaner-db";
import { mergeHistoryPage } from "@/lib/history";

const PAGE = 60;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  const before = searchParams.get("before");
  const beforeDate = before && !Number.isNaN(Date.parse(before)) ? new Date(before) : null;

  const entries = await prisma.completionLog.findMany({
    where: {
      ...(userId ? { OR: [{ completedById: userId }, { completedById: null }] } : {}),
      ...(beforeDate ? { completedAt: { lt: beforeDate } } : {}),
    },
    include: {
      task: { include: { room: { select: { name: true } } } },
      user: { select: { id: true, name: true, color: true } },
      completedBy: { select: { id: true, name: true, color: true } },
    },
    orderBy: [{ completedAt: "desc" }, { id: "desc" }],
    take: PAGE + 1,
  });

  const jar = await cookies();
  const viewerId = await verifySessionToken(jar.get(COOKIE_NAME)?.value);
  const ownerId = viewerId ? await accountOwnerId() : null;
  let notes: { id: string; body: string; createdAt: Date }[] = [];
  if (viewerId && viewerId === ownerId) {
    const cleaner = await prisma.user.findFirst({ where: { cleaner: true }, select: { id: true } });
    const forThisPerson = !userId || userId === cleaner?.id;
    if (forThisPerson) {
      notes = await prisma.cleanerNote.findMany({
        where: beforeDate ? { createdAt: { lt: beforeDate } } : {},
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: PAGE + 1,
      });
    }
  }

  const merged = mergeHistoryPage(
    entries.map((entry) => ({ kind: "completion" as const, at: entry.completedAt, id: entry.id, entry })),
    notes.map((note) => ({ kind: "note" as const, at: note.createdAt, id: note.id, body: note.body })),
    PAGE,
  );
  const nextBefore = merged.hasMore ? merged.page[merged.page.length - 1]?.at.toISOString() ?? null : null;

  return NextResponse.json({
    entries: merged.page.map((row) => row.kind === "note"
      ? { kind: "note" as const, id: row.id, completedAt: row.at.toISOString(), body: row.body }
      : { kind: "completion" as const, ...row.entry }),
    nextBefore,
  });
}

export async function DELETE(req: Request) {
  const { id } = await req.json().catch(() => ({}));
  if (typeof id !== "string" || !id) {
    return NextResponse.json({ ok: false, reason: "id required" }, { status: 400 });
  }
  await uncompleteFromLog(id);
  return NextResponse.json({ ok: true });
}
