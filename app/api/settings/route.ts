import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const settings = await prisma.settings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton" },
    update: {},
  });
  // Never expose the session-signing secret to the client.
  const { sessionSecret, ...safe } = settings;
  return NextResponse.json(safe);
}

export async function PATCH(req: Request) {
  const body = await req.json();
  // Whitelist writable fields — sessionSecret is managed by the server only.
  const data: Record<string, unknown> = {};
  if (typeof body.haUrl === "string") data.haUrl = body.haUrl;
  if (typeof body.haToken === "string") data.haToken = body.haToken;
  if (typeof body.darkMode === "boolean") data.darkMode = body.darkMode;

  const settings = await prisma.settings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", ...data },
    update: data,
  });
  const { sessionSecret, ...safe } = settings;
  return NextResponse.json(safe);
}
