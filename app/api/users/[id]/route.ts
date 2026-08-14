import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, generateWebhookSecret } from "@/lib/auth";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  // Only allow specific fields to be set — never accept passwordHash/webhookSecret
  // directly from the client (that would be a mass-assignment hole).
  const data: Record<string, unknown> = {};
  if (typeof body.name === "string") data.name = body.name;
  if (typeof body.haNotifyTarget === "string") data.haNotifyTarget = body.haNotifyTarget;
  if (body.dailyCapacity !== undefined) data.dailyCapacity = Number(body.dailyCapacity);
  if (typeof body.notifyTime === "string") data.notifyTime = body.notifyTime;
  if (typeof body.color === "string") data.color = body.color;

  // Set a password (hashed). Empty/whitespace is ignored.
  if (typeof body.password === "string" && body.password.trim().length > 0) {
    data.passwordHash = hashPassword(body.password);
  }
  // Rotate the webhook token on request.
  if (body.regenerateWebhookSecret === true) {
    data.webhookSecret = generateWebhookSecret();
  }

  const user = await prisma.user.update({
    where: { id },
    data,
    omit: { passwordHash: false, webhookSecret: false },
  });
  const { passwordHash, ...rest } = user;
  return NextResponse.json({ ...rest, hasPassword: passwordHash != null });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
