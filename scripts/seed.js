#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/*
 * Seed the default rooms and tasks (mirrors prisma/seed.ts, but as plain JS so
 * it can run in the production container, and it targets DATABASE_URL — i.e.
 * the real data volume on the Pi — not the local dev.db.
 *
 * Run on the Pi:
 *   docker exec -it sweepy node scripts/seed.js
 *
 * It does NOT create users (do that with set-password.js). If the database
 * already has rooms/tasks/history, it asks before wiping them.
 */
const readline = require("readline");
const { randomBytes } = require("crypto");
const Database = require("better-sqlite3");

const rooms = [
  { name: "Main Bedroom", icon: "🛏️", tasks: [
    { name: "Make bed", difficulty: 1, frequencyDays: 1 },
    { name: "Change bed linens", difficulty: 2, frequencyDays: 14 },
    { name: "Vacuum floor", difficulty: 1, frequencyDays: 7 },
    { name: "Dust surfaces & nightstands", difficulty: 1, frequencyDays: 7 },
    { name: "Clean mirrors", difficulty: 1, frequencyDays: 14 },
    { name: "Dust ceiling fan", difficulty: 1, frequencyDays: 30 },
    { name: "Deep clean under furniture", difficulty: 2, frequencyDays: 60 },
    { name: "Wash pillows", difficulty: 2, frequencyDays: 90 },
  ] },
  { name: "Second Bedroom", icon: "🛏️", tasks: [
    { name: "Vacuum floor", difficulty: 1, frequencyDays: 7 },
    { name: "Dust surfaces", difficulty: 1, frequencyDays: 14 },
    { name: "Change bed linens", difficulty: 2, frequencyDays: 14 },
    { name: "Clean mirrors", difficulty: 1, frequencyDays: 30 },
    { name: "Wipe window sills", difficulty: 1, frequencyDays: 30 },
  ] },
  { name: "Jason's Office", icon: "💻", tasks: [
    { name: "Vacuum floor", difficulty: 1, frequencyDays: 7 },
    { name: "Wipe desk surface", difficulty: 1, frequencyDays: 7 },
    { name: "Empty trash", difficulty: 1, frequencyDays: 7 },
    { name: "Dust electronics & shelves", difficulty: 1, frequencyDays: 14 },
    { name: "Clean monitor screens", difficulty: 1, frequencyDays: 30 },
    { name: "Wipe down keyboard & mouse", difficulty: 1, frequencyDays: 14 },
    { name: "Cable management tidy", difficulty: 1, frequencyDays: 90 },
  ] },
  { name: "Cass' Office", icon: "💻", tasks: [
    { name: "Vacuum floor", difficulty: 1, frequencyDays: 7 },
    { name: "Wipe desk surface", difficulty: 1, frequencyDays: 7 },
    { name: "Empty trash", difficulty: 1, frequencyDays: 7 },
    { name: "Dust electronics & shelves", difficulty: 1, frequencyDays: 14 },
    { name: "Clean monitor screens", difficulty: 1, frequencyDays: 30 },
    { name: "Wipe down keyboard & mouse", difficulty: 1, frequencyDays: 14 },
    { name: "Cable management tidy", difficulty: 1, frequencyDays: 90 },
  ] },
  { name: "Upstairs Bathroom", icon: "🚿", tasks: [
    { name: "Wipe sink & counter", difficulty: 1, frequencyDays: 3 },
    { name: "Clean toilet", difficulty: 2, frequencyDays: 7 },
    { name: "Clean shower", difficulty: 2, frequencyDays: 7 },
    { name: "Mop floor", difficulty: 1, frequencyDays: 7 },
    { name: "Clean mirror", difficulty: 1, frequencyDays: 7 },
    { name: "Empty trash", difficulty: 1, frequencyDays: 7 },
    { name: "Replace hand towels", difficulty: 1, frequencyDays: 7 },
    { name: "Scrub grout", difficulty: 3, frequencyDays: 60 },
    { name: "Deep clean drain", difficulty: 2, frequencyDays: 30 },
  ] },
  { name: "Master Bathroom", icon: "🛁", tasks: [
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
  ] },
  { name: "Downstairs Bathroom", icon: "🚽", tasks: [
    { name: "Wipe sink & counter", difficulty: 1, frequencyDays: 3 },
    { name: "Clean toilet", difficulty: 2, frequencyDays: 7 },
    { name: "Mop floor", difficulty: 1, frequencyDays: 7 },
    { name: "Clean mirror", difficulty: 1, frequencyDays: 7 },
    { name: "Empty trash", difficulty: 1, frequencyDays: 7 },
    { name: "Restock supplies", difficulty: 1, frequencyDays: 14 },
  ] },
  { name: "Kitchen", icon: "🍳", tasks: [
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
  ] },
  { name: "Living Room", icon: "🛋️", tasks: [
    { name: "Vacuum floors & rugs", difficulty: 2, frequencyDays: 7 },
    { name: "Wipe dining table", difficulty: 1, frequencyDays: 3 },
    { name: "Dust surfaces & shelves", difficulty: 1, frequencyDays: 7 },
    { name: "Vacuum sofa cushions", difficulty: 1, frequencyDays: 14 },
    { name: "Wipe TV & electronics", difficulty: 1, frequencyDays: 14 },
    { name: "Dust ceiling fan", difficulty: 1, frequencyDays: 30 },
    { name: "Clean windows", difficulty: 2, frequencyDays: 60 },
    { name: "Wipe baseboards", difficulty: 2, frequencyDays: 60 },
    { name: "Wipe light switches & outlets", difficulty: 1, frequencyDays: 30 },
  ] },
  { name: "Entryway", icon: "🚪", tasks: [
    { name: "Sweep floor", difficulty: 1, frequencyDays: 3 },
    { name: "Wipe front door & handle", difficulty: 1, frequencyDays: 7 },
    { name: "Organize shoes & coats", difficulty: 1, frequencyDays: 7 },
    { name: "Shake out entry mat", difficulty: 1, frequencyDays: 7 },
    { name: "Wipe mirror", difficulty: 1, frequencyDays: 14 },
    { name: "Wash entry mat", difficulty: 2, frequencyDays: 30 },
  ] },
  { name: "Landing", icon: "🪜", tasks: [
    { name: "Vacuum / sweep", difficulty: 1, frequencyDays: 7 },
    { name: "Dust stair railing", difficulty: 1, frequencyDays: 7 },
    { name: "Wipe baseboards", difficulty: 1, frequencyDays: 30 },
  ] },
  { name: "Yard", icon: "🌿", tasks: [
    { name: "Mow lawn", difficulty: 3, frequencyDays: 7 },
    { name: "Sweep patio & walkways", difficulty: 2, frequencyDays: 7 },
    { name: "Weed garden beds", difficulty: 2, frequencyDays: 14 },
    { name: "Trim hedges & bushes", difficulty: 3, frequencyDays: 30 },
    { name: "Blow / rake leaves", difficulty: 2, frequencyDays: 14 },
    { name: "Clean outdoor furniture", difficulty: 2, frequencyDays: 30 },
    { name: "Check gutters", difficulty: 2, frequencyDays: 90 },
    { name: "Fertilize lawn", difficulty: 2, frequencyDays: 90 },
  ] },
  { name: "Server Room", icon: "🖥️", tasks: [
    { name: "Dust equipment & racks", difficulty: 1, frequencyDays: 30 },
    { name: "Vacuum floor", difficulty: 1, frequencyDays: 30 },
    { name: "Tidy cable management", difficulty: 2, frequencyDays: 90 },
    { name: "Wipe down surfaces", difficulty: 1, frequencyDays: 30 },
    { name: "Check & clean filters/vents", difficulty: 2, frequencyDays: 90 },
  ] },
  { name: "Garage", icon: "🚗", tasks: [
    { name: "Sweep floor", difficulty: 2, frequencyDays: 14 },
    { name: "Organize shelving & bins", difficulty: 3, frequencyDays: 30 },
    { name: "Wipe down surfaces & workbench", difficulty: 1, frequencyDays: 30 },
    { name: "Remove trash & recycling", difficulty: 1, frequencyDays: 14 },
    { name: "Deep clean & declutter", difficulty: 3, frequencyDays: 180 },
  ] },
];

function id() {
  return randomBytes(12).toString("hex");
}

function ask(query) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(query, (a) => { rl.close(); resolve(a.trim()); }));
}

(async () => {
  const dbUrl = process.env.DATABASE_URL || "file:./prisma/dev.db";
  const db = new Database(dbUrl.replace(/^file:/, ""));

  // Safety: don't silently wipe an existing database.
  const counts = {
    rooms: db.prepare("SELECT count(*) c FROM Room").get().c,
    tasks: db.prepare("SELECT count(*) c FROM Task").get().c,
    completions: db.prepare("SELECT count(*) c FROM CompletionLog").get().c,
  };
  if (counts.rooms || counts.tasks || counts.completions) {
    console.log(`This database already has ${counts.rooms} rooms, ${counts.tasks} tasks, ${counts.completions} completions.`);
    const ans = await ask("Seeding DELETES all of that and re-creates the defaults. Continue? (y/n): ");
    if (ans.toLowerCase() !== "y") {
      console.log("Aborted — nothing changed.");
      process.exit(0);
    }
  }

  const seed = db.transaction(() => {
    db.prepare("DELETE FROM TaskAssignableUser").run();
    db.prepare("DELETE FROM DailyAssignment").run();
    db.prepare("DELETE FROM CompletionLog").run();
    db.prepare("DELETE FROM Task").run();
    db.prepare("DELETE FROM Room").run();

    const insRoom = db.prepare('INSERT INTO Room (id, name, icon, "order") VALUES (?, ?, ?, ?)');
    const insTask = db.prepare("INSERT INTO Task (id, name, roomId, difficulty, frequencyDays) VALUES (?, ?, ?, ?, ?)");

    let taskCount = 0;
    rooms.forEach((room, i) => {
      const roomId = id();
      insRoom.run(roomId, room.name, room.icon, i);
      for (const t of room.tasks) {
        insTask.run(id(), t.name, roomId, t.difficulty, t.frequencyDays);
        taskCount++;
      }
    });
    return taskCount;
  });

  const taskCount = seed();
  console.log(`\n✓ Seeded ${rooms.length} rooms with ${taskCount} tasks.`);
  console.log("Next: create your login with  node scripts/set-password.js");
  db.close();
})();
