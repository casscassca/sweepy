import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json(users);
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
    },
  });
  return NextResponse.json(user, { status: 201 });
}
