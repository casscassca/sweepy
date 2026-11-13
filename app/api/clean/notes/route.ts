import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE_NAME, verifySessionToken } from "@/lib/auth";
import { accountOwnerId, hasCleanerAccess } from "@/lib/cleaner-db";
import { prisma } from "@/lib/prisma";

async function isOwner(userId: string) {
  return (await accountOwnerId()) === userId;
}

export async function GET() {
  const jar = await cookies();
  const userId = await verifySessionToken(jar.get(COOKIE_NAME)?.value);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!await isOwner(userId)) return NextResponse.json([]);
  const notes = await prisma.cleanerNote.findMany({
    where: { dismissedAt: null },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(notes);
}

export async function POST(req: Request) {
  if (!await hasCleanerAccess()) {
    return NextResponse.json({ error: "locked" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const text = typeof body.body === "string" ? body.body.trim().slice(0, 2000) : "";
  if (!text) return NextResponse.json({ ok: false, reason: "empty" }, { status: 400 });
  const note = await prisma.cleanerNote.create({ data: { body: text } });
  return NextResponse.json(note, { status: 201 });
}

export async function DELETE(req: Request) {
  const jar = await cookies();
  const userId = await verifySessionToken(jar.get(COOKIE_NAME)?.value);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!await isOwner(userId)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  if (typeof body.id !== "string" || !body.id) {
    return NextResponse.json({ ok: false, reason: "id required" }, { status: 400 });
  }
  await prisma.cleanerNote.update({
    where: { id: body.id },
    data: { dismissedAt: new Date() },
  }).catch(() => null);
  return NextResponse.json({ ok: true });
}
