#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/*
 * Create the first account, or set/reset a household member's login password.
 *
 *   docker exec -it sweepy node scripts/set-password.js
 *   docker exec -it sweepy node scripts/set-password.js Cassandra
 *
 * Uses DATABASE_URL (Postgres). The password is typed interactively.
 */
require("dotenv").config();
const readline = require("readline");
const { randomBytes, scryptSync } = require("crypto");
const { Pool } = require("pg");

function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt:${salt.toString("hex")}:${hash.toString("hex")}`;
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

function askHidden(query) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    let muted = false;
    rl._writeToOutput = (s) => { if (!muted) rl.output.write(s); };
    rl.question(query, (value) => { rl.close(); process.stdout.write("\n"); resolve(value); });
    muted = true;
  });
}

(async () => {
  const url = process.env.DATABASE_URL;
  if (!url || url.startsWith("file:")) {
    console.error("DATABASE_URL must be a Postgres URI.");
    process.exit(1);
  }
  const pool = new Pool(poolOpts(url));

  const PALETTE = ["#a78bfa", "#f472b6", "#fb923c", "#34d399", "#60a5fa", "#f87171", "#facc15", "#2dd4bf"];

  const { rows: users } = await pool.query(
    'SELECT id, name, "passwordHash", "webhookSecret" FROM "User" ORDER BY "createdAt"',
  );

  let name = process.argv[2];
  if (!name) {
    if (users.length > 0) {
      console.log("People:");
      for (const u of users) console.log(`  - ${u.name}${u.passwordHash ? " (has password)" : ""}`);
    } else {
      console.log("No people exist yet, let's create the first account.");
    }
    name = await ask("\nName: ");
  }
  if (!name) {
    console.error("A name is required.");
    process.exit(1);
  }

  const user = users.find((u) => u.name.toLowerCase() === name.toLowerCase());
  if (!user) {
    const create = await ask(`No person named "${name}". Create them? (y/n): `);
    if (create.toLowerCase() !== "y") process.exit(1);
  }

  const pw = await askHidden(`Password for ${name}: `);
  if (pw.length < 4) {
    console.error("Password must be at least 4 characters.");
    process.exit(1);
  }
  const confirm = await askHidden("Confirm password: ");
  if (pw !== confirm) {
    console.error("Passwords do not match.");
    process.exit(1);
  }

  let newSecret;
  if (user) {
    newSecret = user.webhookSecret ? null : randomBytes(24).toString("hex");
    if (newSecret) {
      await pool.query('UPDATE "User" SET "passwordHash" = $1, "webhookSecret" = $2 WHERE id = $3', [
        hashPassword(pw), newSecret, user.id,
      ]);
    } else {
      await pool.query('UPDATE "User" SET "passwordHash" = $1 WHERE id = $2', [hashPassword(pw), user.id]);
    }
    console.log(`\nPassword updated for ${user.name}.`);
  } else {
    const id = randomBytes(16).toString("hex");
    newSecret = randomBytes(24).toString("hex");
    const color = PALETTE[users.length % PALETTE.length];
    await pool.query(
      'INSERT INTO "User" (id, name, color, "webhookSecret", "passwordHash") VALUES ($1, $2, $3, $4, $5)',
      [id, name, color, newSecret, hashPassword(pw)],
    );
    console.log(`\nCreated ${name} and set their password.`);
  }

  if (newSecret) console.log(`  Webhook token (for Home Assistant): ${newSecret}`);
  await pool.end();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
