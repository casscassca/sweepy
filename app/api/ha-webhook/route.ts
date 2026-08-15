import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { appendIntegrationLog } from "@/lib/integration-log";
import { applyNotifyAction } from "@/lib/notify-actions";

// Optional backup: Home Assistant automations can POST here. The live path is
// Sweepy listening for mobile_app_notification_action on the HA websocket.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const token = req.headers.get("x-webhook-secret") ?? body?.secret ?? "";

  if (!token) {
    await appendIntegrationLog({ kind: "webhook", ok: false, summary: "missing webhook secret" });
    return NextResponse.json({ ok: false, reason: "missing secret" }, { status: 401 });
  }
  const actor = await prisma.user.findFirst({ where: { webhookSecret: String(token) } });
  if (!actor) {
    await appendIntegrationLog({ kind: "webhook", ok: false, summary: "invalid webhook secret" });
    return NextResponse.json({ ok: false, reason: "invalid secret" }, { status: 401 });
  }

  const action: string = body?.action ?? body?.event?.action ?? "";
  const result = await applyNotifyAction({ action, actorId: actor.id, source: "webhook" });
  return NextResponse.json(result, { status: result.ok ? 200 : result.status });
}
