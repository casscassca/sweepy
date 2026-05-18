import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../app/generated/prisma/client";
import path from "path";

const adapter = new PrismaBetterSqlite3({ url: path.join(process.cwd(), "prisma/dev.db") });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = new PrismaClient({ adapter } as any);

const rooms = [
  {
    name: "Main Bedroom", icon: "🛏️", tasks: [
      { name: "Make bed", difficulty: 1, frequencyDays: 1 },
      { name: "Change bed linens", difficulty: 2, frequencyDays: 14 },
      { name: "Vacuum floor", difficulty: 1, frequencyDays: 7 },
      { name: "Dust surfaces & nightstands", difficulty: 1, frequencyDays: 7 },
      { name: "Clean mirrors", difficulty: 1, frequencyDays: 14 },
      { name: "Dust ceiling fan", difficulty: 1, frequencyDays: 30 },
      { name: "Deep clean under furniture", difficulty: 2, frequencyDays: 60 },
      { name: "Wash pillows", difficulty: 2, frequencyDays: 90 },
    ],
  },
  {
    name: "Second Bedroom", icon: "🛏️", tasks: [
      { name: "Vacuum floor", difficulty: 1, frequencyDays: 7 },
      { name: "Dust surfaces", difficulty: 1, frequencyDays: 14 },
      { name: "Change bed linens", difficulty: 2, frequencyDays: 14 },
      { name: "Clean mirrors", difficulty: 1, frequencyDays: 30 },
      { name: "Wipe window sills", difficulty: 1, frequencyDays: 30 },
    ],
  },
  {
    name: "Jason's Office", icon: "💻", tasks: [
      { name: "Vacuum floor", difficulty: 1, frequencyDays: 7 },
      { name: "Wipe desk surface", difficulty: 1, frequencyDays: 7 },
      { name: "Empty trash", difficulty: 1, frequencyDays: 7 },
      { name: "Dust electronics & shelves", difficulty: 1, frequencyDays: 14 },
      { name: "Clean monitor screens", difficulty: 1, frequencyDays: 30 },
      { name: "Wipe down keyboard & mouse", difficulty: 1, frequencyDays: 14 },
      { name: "Cable management tidy", difficulty: 1, frequencyDays: 90 },
    ],
  },
  {
    name: "Cass' Office", icon: "💻", tasks: [
      { name: "Vacuum floor", difficulty: 1, frequencyDays: 7 },
      { name: "Wipe desk surface", difficulty: 1, frequencyDays: 7 },
      { name: "Empty trash", difficulty: 1, frequencyDays: 7 },
      { name: "Dust electronics & shelves", difficulty: 1, frequencyDays: 14 },
      { name: "Clean monitor screens", difficulty: 1, frequencyDays: 30 },
      { name: "Wipe down keyboard & mouse", difficulty: 1, frequencyDays: 14 },
      { name: "Cable management tidy", difficulty: 1, frequencyDays: 90 },
    ],
  },
  {
    name: "Upstairs Bathroom", icon: "🚿", tasks: [
      { name: "Wipe sink & counter", difficulty: 1, frequencyDays: 3 },
      { name: "Clean toilet", difficulty: 2, frequencyDays: 7 },
      { name: "Clean shower", difficulty: 2, frequencyDays: 7 },
      { name: "Mop floor", difficulty: 1, frequencyDays: 7 },
      { name: "Clean mirror", difficulty: 1, frequencyDays: 7 },
      { name: "Empty trash", difficulty: 1, frequencyDays: 7 },
      { name: "Replace hand towels", difficulty: 1, frequencyDays: 7 },
      { name: "Scrub grout", difficulty: 3, frequencyDays: 60 },
      { name: "Deep clean drain", difficulty: 2, frequencyDays: 30 },
    ],
  },
  {
    name: "Master Bathroom", icon: "🛁", tasks: [
      { name: "Wipe sink & counter", difficulty: 1, frequencyDays: 3 },
      { name: "Clean toilet", difficulty: 2, frequencyDays: 7 },
      { name: "Clean shower & tub", difficulty: 2, frequencyDays: 7 },
      { name: "Mop floor", difficulty: 1, frequencyDays: 7 },
      { name: "Clean mirrors", difficulty: 1, frequencyDays: 7 },
      { name: "Empty trash", difficulty: 1, frequencyDays: 7 },
      { name: "Replace towels", difficulty: 1, frequencyDays: 7 },
      { name: "Scrub grout", difficulty: 3, frequencyDays: 60 },
      { name: "Deep clean drain", difficulty: 2, frequencyDays: 30 },
      { name: "Descale showerhead", difficulty: 2, frequencyDays: 90 },
    ],
  },
  {
    name: "Downstairs Bathroom", icon: "🚽", tasks: [
      { name: "Wipe sink & counter", difficulty: 1, frequencyDays: 3 },
      { name: "Clean toilet", difficulty: 2, frequencyDays: 7 },
      { name: "Mop floor", difficulty: 1, frequencyDays: 7 },
      { name: "Clean mirror", difficulty: 1, frequencyDays: 7 },
      { name: "Empty trash", difficulty: 1, frequencyDays: 7 },
      { name: "Restock supplies", difficulty: 1, frequencyDays: 14 },
    ],
  },
  {
    name: "Kitchen", icon: "🍳", tasks: [
      { name: "Wipe counters", difficulty: 1, frequencyDays: 1 },
      { name: "Clean stovetop", difficulty: 2, frequencyDays: 3 },
      { name: "Wipe sink", difficulty: 1, frequencyDays: 3 },
      { name: "Empty trash & recycling", difficulty: 1, frequencyDays: 3 },
      { name: "Wipe microwave (inside & out)", difficulty: 1, frequencyDays: 7 },
      { name: "Sweep & mop floor", difficulty: 2, frequencyDays: 7 },
      { name: "Wipe appliance fronts", difficulty: 1, frequencyDays: 7 },
      { name: "Wipe cabinet fronts", difficulty: 2, frequencyDays: 14 },
      { name: "Clean refrigerator (interior)", difficulty: 3, frequencyDays: 30 },
      { name: "Clean oven", difficulty: 3, frequencyDays: 60 },
      { name: "Descale kettle & coffee maker", difficulty: 2, frequencyDays: 30 },
      { name: "Clean range hood filter", difficulty: 2, frequencyDays: 90 },
    ],
  },
  {
    name: "Living Room", icon: "🛋️", tasks: [
      { name: "Vacuum floors & rugs", difficulty: 2, frequencyDays: 7 },
      { name: "Wipe dining table", difficulty: 1, frequencyDays: 3 },
      { name: "Dust surfaces & shelves", difficulty: 1, frequencyDays: 7 },
      { name: "Vacuum sofa cushions", difficulty: 1, frequencyDays: 14 },
      { name: "Wipe TV & electronics", difficulty: 1, frequencyDays: 14 },
      { name: "Dust ceiling fan", difficulty: 1, frequencyDays: 30 },
      { name: "Clean windows", difficulty: 2, frequencyDays: 60 },
      { name: "Wipe baseboards", difficulty: 2, frequencyDays: 60 },
      { name: "Wipe light switches & outlets", difficulty: 1, frequencyDays: 30 },
    ],
  },
  {
    name: "Entryway", icon: "🚪", tasks: [
      { name: "Sweep floor", difficulty: 1, frequencyDays: 3 },
      { name: "Wipe front door & handle", difficulty: 1, frequencyDays: 7 },
      { name: "Organize shoes & coats", difficulty: 1, frequencyDays: 7 },
      { name: "Shake out entry mat", difficulty: 1, frequencyDays: 7 },
      { name: "Wipe mirror", difficulty: 1, frequencyDays: 14 },
      { name: "Wash entry mat", difficulty: 2, frequencyDays: 30 },
    ],
  },
  {
    name: "Landing", icon: "🪜", tasks: [
      { name: "Vacuum / sweep", difficulty: 1, frequencyDays: 7 },
      { name: "Dust stair railing", difficulty: 1, frequencyDays: 7 },
      { name: "Wipe baseboards", difficulty: 1, frequencyDays: 30 },
    ],
  },
  {
    name: "Yard", icon: "🌿", tasks: [
      { name: "Mow lawn", difficulty: 3, frequencyDays: 7 },
      { name: "Sweep patio & walkways", difficulty: 2, frequencyDays: 7 },
      { name: "Weed garden beds", difficulty: 2, frequencyDays: 14 },
      { name: "Trim hedges & bushes", difficulty: 3, frequencyDays: 30 },
      { name: "Blow / rake leaves", difficulty: 2, frequencyDays: 14 },
      { name: "Clean outdoor furniture", difficulty: 2, frequencyDays: 30 },
      { name: "Check gutters", difficulty: 2, frequencyDays: 90 },
      { name: "Fertilize lawn", difficulty: 2, frequencyDays: 90 },
    ],
  },
  {
    name: "Server Room", icon: "🖥️", tasks: [
      { name: "Dust equipment & racks", difficulty: 1, frequencyDays: 30 },
      { name: "Vacuum floor", difficulty: 1, frequencyDays: 30 },
      { name: "Tidy cable management", difficulty: 2, frequencyDays: 90 },
      { name: "Wipe down surfaces", difficulty: 1, frequencyDays: 30 },
      { name: "Check & clean filters/vents", difficulty: 2, frequencyDays: 90 },
    ],
  },
  {
    name: "Garage", icon: "🚗", tasks: [
      { name: "Sweep floor", difficulty: 2, frequencyDays: 14 },
      { name: "Organize shelving & bins", difficulty: 3, frequencyDays: 30 },
      { name: "Wipe down surfaces & workbench", difficulty: 1, frequencyDays: 30 },
      { name: "Remove trash & recycling", difficulty: 1, frequencyDays: 14 },
      { name: "Deep clean & declutter", difficulty: 3, frequencyDays: 180 },
    ],
  },
];

async function main() {
  console.log("Seeding rooms and tasks...");

  // Clear existing rooms/tasks
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
      await prisma.task.create({ data: { ...task, roomId: room.id } });
    }
  }

  console.log(`\nDone! Created ${rooms.length} rooms with ${rooms.reduce((s, r) => s + r.tasks.length, 0)} tasks total.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
