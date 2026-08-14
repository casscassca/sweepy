import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateWebhookSecret } from "@/lib/auth";

export async function GET() {
  // Re-include the secrets (globally omitted) so the People page can show the
  // webhook token and whether a password is set — but never send the hash itself.
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    omit: { passwordHash: false, webhookSecret: false },
  });
  const safe = users.map(({ passwordHash, ...u }) => ({ ...u, hasPassword: passwordHash != null }));
  return NextResponse.json(safe);
}

export async function POST(req: Request) {
  const { name, haNotifyTarget, dailyCapacity, notifyTime, color } = await req.json();
  const user = await prisma.user.create({
    data: {
      name,
      haNotifyTarget: haNotifyTarget ?? "",
      dailyCapacity: Number(dailyCapacity ?? 6),
      notifyTime: notifyTime ?? "08:00",
      color: color ?? "#6366f1",
      webhookSecret: generateWebhookSecret(),
    },
  });
  return NextResponse.json(user, { status: 201 });
}
