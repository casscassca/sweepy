import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../app/generated/prisma/client";
import path from "path";
import { lastDoneAtFromRatio } from "../lib/dirtiness";
import rooms from "../scripts/starter-catalog.json";

const adapter = new PrismaBetterSqlite3({ url: path.join(process.cwd(), "prisma/dev.db") });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = new PrismaClient({ adapter } as any);

function lastDoneAt(dirtiness: number, frequencyDays: number) {
  if (dirtiness >= 3) return null;
  return lastDoneAtFromRatio(dirtiness <= 1 ? 0.2 : 1, frequencyDays);
}

async function main() {
  console.log("Seeding rooms and tasks...");

  await prisma.taskAssignableUser.deleteMany();
  await prisma.dailyAssignment.deleteMany();
  await prisma.completionLog.deleteMany();
  await prisma.task.deleteMany();
  await prisma.room.deleteMany();

  for (let i = 0; i < rooms.length; i++) {
    const { name, icon, tasks } = rooms[i];
    const room = await prisma.room.create({ data: { name, icon, order: i } });
    console.log(`  Created room: ${icon} ${name} (${tasks.length} tasks)`);

    for (const task of tasks) {
      await prisma.task.create({
        data: {
          name: task.name,
          difficulty: task.difficulty,
          frequencyDays: task.frequencyDays,
          lastDoneAt: lastDoneAt(task.dirtiness, task.frequencyDays),
          roomId: room.id,
        },
      });
    }
  }

  const total = rooms.reduce((s, r) => s + r.tasks.length, 0);
  console.log(`\nDone! Created ${rooms.length} rooms with ${total} tasks total.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
