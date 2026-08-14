import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { COOKIE_NAME, SESSION_TTL_SECONDS, createSessionToken, verifyPassword } from "@/lib/auth";

export async function POST(req: Request) {
  const { userId, password } = await req.json();

  // Re-include passwordHash (globally omitted) just for this verification.
  const user =
    typeof userId === "string"
      ? await prisma.user.findUnique({ where: { id: userId }, omit: { passwordHash: false } })
      : null;

  if (!user || !verifyPassword(String(password ?? ""), user.passwordHash)) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  const token = await createSessionToken(user.id);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });

  return NextResponse.json({ ok: true, user: { id: user.id, name: user.name, color: user.color } });
}
