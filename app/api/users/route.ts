import { NextResponse } from "next/server";
import { encodeWeek, parseWeek } from "@/lib/capacity";
import { prisma } from "@/lib/prisma";
import { generateWebhookSecret } from "@/lib/auth";
import { ymd } from "@/lib/vacation";

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

function clampDaily(n: unknown, fallback = 6) {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return fallback;
  return Math.min(20, Math.max(1, v));
}

function clampWeekend(n: unknown, fallback: number) {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return fallback;
  return Math.min(20, Math.max(0, v));
}

export async function POST(req: Request) {
  const body = await req.json();
  const { name, haNotifyTarget, dailyCapacity, dailyTaskLimit, weekdayCapacities, weekdayTaskLimits, weekendShare, weekendCapacity, weekendTaskLimit, notifyTime, color } = body;
  const pts = clampDaily(dailyCapacity);
  const tasks = clampDaily(dailyTaskLimit);
  const user = await prisma.user.create({
    data: {
      name,
      haNotifyTarget: haNotifyTarget ?? "",
      dailyCapacity: pts,
      dailyTaskLimit: tasks,
      weekdayCapacities: encodeWeek(parseWeek(typeof weekdayCapacities === "string" ? weekdayCapacities : "", pts)),
      weekdayTaskLimits: encodeWeek(parseWeek(typeof weekdayTaskLimits === "string" ? weekdayTaskLimits : "", tasks)),
      weekendShare: weekendShare !== false,
      weekendCapacity: clampWeekend(weekendCapacity, 6),
      weekendTaskLimit: clampWeekend(weekendTaskLimit, 4),
      vacationOn: body.vacationOn === true,
      vacationStart: ymd(body.vacationStart),
      vacationEnd: ymd(body.vacationEnd),
      notifyTime: notifyTime ?? "08:00",
      color: color ?? "#6366f1",
      webhookSecret: generateWebhookSecret(),
    },
  });
  return NextResponse.json(user, { status: 201 });
}
