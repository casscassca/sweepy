#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/*
 * Copy a Sweepy SQLite backup into Postgres (Supabase).
 *
 *   node scripts/copy-sqlite-to-pg.js ~/Downloads/sweepy-backup-20260819.db
 *
 * Uses DIRECT_URL (session pooler) when set. Does not wipe other public
 * tables. Replaces Sweepy rows only.
 */
require("dotenv").config();
const { DatabaseSync } = require("node:sqlite");
const { Pool } = require("pg");
const { pgOpts } = require("./pg-opts");

const sqlitePath = process.argv[2];
if (!sqlitePath) {
  console.error("Usage: node scripts/copy-sqlite-to-pg.js <backup.db>");
  process.exit(1);
}

const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("DIRECT_URL or DATABASE_URL is not set");
  process.exit(1);
}

const BOOL = new Set([
  "weekendShare", "vacationOn", "oneOff", "important", "dueOnly",
  "held", "pinned", "parked", "darkMode", "houseVacation", "pauseDirtiness", "ok",
]);
const DATE = new Set([
  "createdAt", "lastDoneAt", "addonLastDoneAt", "completedAt", "remindAt",
]);

function bool(v) {
  return v === 1 || v === true || v === "true" || v === "t";
}

function date(v) {
  if (v == null || v === "") return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

const TABLES = [
  "Room",
  "User",
  "Settings",
  "Task",
  "TaskAssignableUser",
  "DailyAssignment",
  "CompletionLog",
  "IntegrationLog",
];

(async () => {
  const sqlite = new DatabaseSync(sqlitePath, { readOnly: true });
  const pool = new Pool(pgOpts(url));
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query('DELETE FROM "CompletionLog"');
    await client.query('DELETE FROM "DailyAssignment"');
    await client.query('DELETE FROM "TaskAssignableUser"');
    await client.query('DELETE FROM "Task"');
    await client.query('DELETE FROM "IntegrationLog"');
    await client.query('DELETE FROM "Settings"');
    await client.query('DELETE FROM "User"');
    await client.query('DELETE FROM "Room"');

    for (const table of TABLES) {
      const rows = sqlite.prepare(`SELECT * FROM "${table}"`).all();
      if (rows.length === 0) {
        console.log(`${table}: 0`);
        continue;
      }
      const cols = Object.keys(rows[0]);
      const quoted = cols.map((c) => `"${c}"`).join(", ");
      const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
      const sql = `INSERT INTO "${table}" (${quoted}) VALUES (${placeholders})`;
      for (const row of rows) {
        const values = cols.map((c) => {
          const v = row[c];
          if (BOOL.has(c)) return bool(v);
          if (DATE.has(c)) return date(v);
          return v;
        });
        await client.query(sql, values);
      }
      console.log(`${table}: ${rows.length}`);
    }
    await client.query("COMMIT");
    console.log("Done.");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
    sqlite.close();
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
