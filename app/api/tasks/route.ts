import { NextResponse } from "next/server";
import { addonFields } from "@/lib/addon";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const { name, roomId, difficulty, frequencyDays, allowedDays, assignableUserIds, lastDoneAt, important, dueOnly, notes, addonName, addonFrequencyDays, addonPoints, addonLastDoneAt } = await req.json();
  const addon = addonFields({ addonName, addonFrequencyDays, addonPoints, addonLastDoneAt });

  const task = await prisma.task.create({
    data: {
      name,
      roomId,
      difficulty: Number(difficulty),
      frequencyDays: Number(frequencyDays),
      allowedDays: allowedDays ?? null,
      lastDoneAt: lastDoneAt ? new Date(lastDoneAt) : null,
      important: Boolean(important),
      dueOnly: Boolean(dueOnly),
      notes: typeof notes === "string" ? notes.trim().slice(0, 2000) : "",
      ...addon,
      assignableUsers: assignableUserIds?.length
        ? { create: assignableUserIds.map((userId: string) => ({ userId })) }
        : undefined,
    },
    include: { assignableUsers: { include: { user: true } } },
  });

  return NextResponse.json(task, { status: 201 });
}
