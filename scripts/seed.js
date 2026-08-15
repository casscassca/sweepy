#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/*
 * Seed the starter rooms and tasks from starter-catalog.json onto DATABASE_URL
 * (the data volume on the Pi, or prisma/dev.db locally).
 *
 *   docker exec -it sweepy node scripts/seed.js
 *
 * Does not create users (use set-password.js). Asks before wiping existing
 * rooms, tasks, or history.
 *
 * Dirtiness 1–3 in the catalog maps to the in-app slider:
 *   1 clean → just cleaned,  2 medium → due,  3 high → filthy (never done).
 */
const readline = require("readline");
const { randomBytes } = require("crypto");
const Database = require("better-sqlite3");
const rooms = require("./starter-catalog.json");

function id() {
  return randomBytes(12).toString("hex");
}

function ask(query) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(query, (a) => { rl.close(); resolve(a.trim()); }));
}

/** Catalog dirtiness 1–3 → lastDoneAt (null = filthy). */
function lastDoneAtFromDirtiness(dirtiness, frequencyDays) {
  if (!dirtiness || dirtiness >= 3 || frequencyDays <= 0) return null;
  const ratio = dirtiness <= 1 ? 0.2 : 1;
  return new Date(Date.now() - ratio * frequencyDays * 86400000).toISOString();
}

(async () => {
  const dbUrl = process.env.DATABASE_URL || "file:./prisma/dev.db";
  const db = new Database(dbUrl.replace(/^file:/, ""));

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
    const insTask = db.prepare(
      "INSERT INTO Task (id, name, roomId, difficulty, frequencyDays, lastDoneAt) VALUES (?, ?, ?, ?, ?, ?)",
    );

    let taskCount = 0;
    rooms.forEach((room, i) => {
      const roomId = id();
      insRoom.run(roomId, room.name, room.icon, i);
      for (const t of room.tasks) {
        insTask.run(
          id(),
          t.name,
          roomId,
          t.difficulty,
          t.frequencyDays,
          lastDoneAtFromDirtiness(t.dirtiness, t.frequencyDays),
        );
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
