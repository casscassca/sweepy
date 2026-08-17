import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { uncompleteFromLog } from "@/lib/complete";

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

  const hasMore = entries.length > PAGE;
  const page = hasMore ? entries.slice(0, PAGE) : entries;
  const nextBefore = hasMore ? page[page.length - 1]?.completedAt.toISOString() ?? null : null;

  return NextResponse.json({
    entries: page,
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
