import { NextResponse } from "next/server";
import { cleanerChecklist } from "@/lib/cleaner";
import { hasCleanerAccess } from "@/lib/cleaner-db";
import { calendarDayStr } from "@/lib/dates";
import { prisma } from "@/lib/prisma";

export async function GET() {
  if (!await hasCleanerAccess()) {
    return NextResponse.json({ error: "locked" }, { status: 401 });
  }
  const settings = await prisma.settings.findUnique({ where: { id: "singleton" }, select: { cleanerCode: true } });
  if (!settings?.cleanerCode) {
    return NextResponse.json({ error: "off" }, { status: 403 });
  }
  const [rooms, unassigned] = await Promise.all([
    prisma.room.findMany({
      where: { hideFromCleaner: false },
      orderBy: { order: "asc" },
      include: {
        tasks: { where: { oneOff: false, hideFromCleaner: false }, orderBy: { name: "asc" } },
      },
    }),
    prisma.task.findMany({
      where: { oneOff: false, hideFromCleaner: false, roomId: null },
      orderBy: { name: "asc" },
    }),
  ]);
  return NextResponse.json({
    sections: cleanerChecklist(rooms, unassigned, calendarDayStr()),
  });
}
