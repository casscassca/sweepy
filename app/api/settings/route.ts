import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const settings = await prisma.settings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton" },
    update: {},
  });
  // Never expose the session-signing secret or leftover HA fields to the client.
  const { sessionSecret, haUrl: _haUrl, haToken: _haToken, ...safe } = settings;
  return NextResponse.json(safe);
}

export async function PATCH(req: Request) {
  const body = await req.json();
  // Whitelist writable fields — sessionSecret and HA credentials are not set here.
  const data: Record<string, unknown> = {};
  if (typeof body.darkMode === "boolean") data.darkMode = body.darkMode;

  const settings = await prisma.settings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", ...data },
    update: data,
  });
  const { sessionSecret, haUrl: _haUrl, haToken: _haToken, ...safe } = settings;
  return NextResponse.json(safe);
}
