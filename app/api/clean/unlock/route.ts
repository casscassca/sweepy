import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_TTL_SECONDS } from "@/lib/auth";
import { cleanerCodesMatch } from "@/lib/cleaner";
import { CLEANER_COOKIE, createCleanerToken, ensureCleaner } from "@/lib/cleaner-db";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const settings = await prisma.settings.findUnique({ where: { id: "singleton" }, select: { cleanerCode: true } });
  if (!cleanerCodesMatch(body.code, settings?.cleanerCode ?? "")) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  await ensureCleaner();
  const token = await createCleanerToken();
  const jar = await cookies();
  jar.set(CLEANER_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  return NextResponse.json({ ok: true });
}
