import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const { name, roomId, difficulty, frequencyDays, allowedDays, assignableUserIds, lastDoneAt } = await req.json();

  const task = await prisma.task.create({
    data: {
      name,
      roomId,
      difficulty: Number(difficulty),
      frequencyDays: Number(frequencyDays),
      allowedDays: allowedDays ?? null,
      lastDoneAt: lastDoneAt ? new Date(lastDoneAt) : null,
      assignableUsers: assignableUserIds?.length
        ? { create: assignableUserIds.map((userId: string) => ({ userId })) }
        : undefined,
    },
    include: { assignableUsers: { include: { user: true } } },
  });

  return NextResponse.json(task, { status: 201 });
}
