import { NextResponse } from "next/server";
import { scheduleHaMqttSync } from "@/lib/ha-mqtt";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const rooms = await prisma.room.findMany({
    orderBy: { order: "asc" },
    include: {
      tasks: {
        where: { oneOff: false },
        orderBy: { createdAt: "asc" },
        include: { assignableUsers: { include: { user: true } } },
      },
    },
  });
  return NextResponse.json(rooms);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name : "";
  const icon = typeof body.icon === "string" && body.icon ? body.icon : "🏠";
  const hideFromCleaner = body.hideFromCleaner === true;
  const count = await prisma.room.count();
  const room = await prisma.room.create({ data: { name, icon, order: count, hideFromCleaner } });
  scheduleHaMqttSync();
  return NextResponse.json(room, { status: 201 });
}
