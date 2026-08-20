#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/*
 * Seed the starter rooms and tasks from starter-catalog.json onto DATABASE_URL.
 *
 *   docker exec -it sweepy node scripts/seed.js
 *
 * Does not create users (use set-password.js). Asks before wiping existing
 * rooms, tasks, or history.
 */
require("dotenv").config();
const readline = require("readline");
const { randomBytes } = require("crypto");
const { Pool } = require("pg");
const rooms = require("./starter-catalog.json");

function id() {
  return randomBytes(12).toString("hex");
}

function poolOpts(url) {
  const parsed = new URL(url);
  parsed.searchParams.delete("sslmode");
  return { connectionString: parsed.toString(), max: 2, ssl: { rejectUnauthorized: false } };
}

function ask(query) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(query, (a) => { rl.close(); resolve(a.trim()); }));
}

function lastDoneAtFromDirtiness(dirtiness, frequencyDays) {
  if (!dirtiness || dirtiness >= 3 || frequencyDays <= 0) return null;
  const ratio = dirtiness <= 1 ? 0.2 : 1;
  return new Date(Date.now() - ratio * frequencyDays * 86400000).toISOString();
}

(async () => {
  const url = process.env.DATABASE_URL;
  if (!url || url.startsWith("file:")) {
    console.error("DATABASE_URL must be a Postgres URI.");
    process.exit(1);
  }
  const pool = new Pool(poolOpts(url));

  const counts = await pool.query(`
    SELECT
      (SELECT count(*)::int FROM "Room") AS rooms,
      (SELECT count(*)::int FROM "Task") AS tasks,
      (SELECT count(*)::int FROM "CompletionLog") AS completions
  `);
  const { rooms: roomN, tasks: taskN, completions } = counts.rows[0];
  if (roomN || taskN || completions) {
    console.log(`This database already has ${roomN} rooms, ${taskN} tasks, ${completions} completions.`);
    const ans = await ask("Seeding DELETES all of that and re-creates the defaults. Continue? (y/n): ");
    if (ans.toLowerCase() !== "y") {
      console.log("Aborted — nothing changed.");
      await pool.end();
      process.exit(0);
    }
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query('DELETE FROM "TaskAssignableUser"');
    await client.query('DELETE FROM "DailyAssignment"');
    await client.query('DELETE FROM "CompletionLog"');
    await client.query('DELETE FROM "Task"');
    await client.query('DELETE FROM "Room"');

    let taskCount = 0;
    for (let i = 0; i < rooms.length; i++) {
      const room = rooms[i];
      const roomId = id();
      await client.query('INSERT INTO "Room" (id, name, icon, "order") VALUES ($1, $2, $3, $4)', [
        roomId, room.name, room.icon, i,
      ]);
      for (const t of room.tasks) {
        await client.query(
          'INSERT INTO "Task" (id, name, "roomId", difficulty, "frequencyDays", "lastDoneAt") VALUES ($1, $2, $3, $4, $5, $6)',
          [id(), t.name, roomId, t.difficulty, t.frequencyDays, lastDoneAtFromDirtiness(t.dirtiness, t.frequencyDays)],
        );
        taskCount++;
      }
    }
    await client.query("COMMIT");
    console.log(`\nSeeded ${rooms.length} rooms with ${taskCount} tasks.`);
    console.log("Next: create your login with  node scripts/set-password.js");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
