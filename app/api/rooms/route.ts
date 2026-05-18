import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const rooms = await prisma.room.findMany({
    orderBy: { order: "asc" },
    include: {
      tasks: {
        orderBy: { createdAt: "asc" },
        include: { assignableUsers: { include: { user: true } } },
      },
    },
  });
  return NextResponse.json(rooms);
}

export async function POST(req: Request) {
  const { name, icon } = await req.json();
  const count = await prisma.room.count();
  const room = await prisma.room.create({ data: { name, icon: icon ?? "🏠", order: count } });
  return NextResponse.json(room, { status: 201 });
}
