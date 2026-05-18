import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.dailyAssignment.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

// Move assignment to a different date
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { date, userId, order } = await req.json();
  const assignment = await prisma.dailyAssignment.update({
    where: { id },
    data: {
      ...(date !== undefined && { date }),
      ...(userId !== undefined && { userId }),
      ...(order !== undefined && { order }),
    },
  });
  return NextResponse.json(assignment);
}
