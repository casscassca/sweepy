#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/*
 * Create the first account, or set/reset a household member's login password.
 *
 * Run it on the Pi inside the running container:
 *   docker exec -it sweepy node scripts/set-password.js
 *   docker exec -it sweepy node scripts/set-password.js Cassandra
 *
 * If the named person doesn't exist yet (e.g. an empty database), it offers to
 * create them — this is how you bootstrap the very first login. It writes
 * directly to the SQLite database, using the same scrypt hash format as the app
 * (lib/auth.ts). The password is typed interactively (never passed as an
 * argument, so it stays out of your shell history). A webhook token is
 * generated for anyone who doesn't have one.
 */
const readline = require("readline");
const { randomBytes, scryptSync } = require("crypto");
const Database = require("better-sqlite3");

function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt:${salt.toString("hex")}:${hash.toString("hex")}`;
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
  const dbUrl = process.env.DATABASE_URL || "file:./prisma/dev.db";
  const dbPath = dbUrl.replace(/^file:/, "");
  const db = new Database(dbPath);

  const PALETTE = ["#a78bfa", "#f472b6", "#fb923c", "#34d399", "#60a5fa", "#f87171", "#facc15", "#2dd4bf"];

  const users = db.prepare("SELECT id, name, passwordHash, webhookSecret FROM User ORDER BY createdAt").all();

  let name = process.argv[2];
  if (!name) {
    if (users.length > 0) {
      console.log("People:");
      for (const u of users) console.log(`  - ${u.name}${u.passwordHash ? " (has password)" : ""}`);
    } else {
      console.log("No people exist yet — let's create the first account.");
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
      db.prepare("UPDATE User SET passwordHash = ?, webhookSecret = ? WHERE id = ?").run(hashPassword(pw), newSecret, user.id);
    } else {
      db.prepare("UPDATE User SET passwordHash = ? WHERE id = ?").run(hashPassword(pw), user.id);
    }
    console.log(`\n✓ Password updated for ${user.name}.`);
  } else {
    // Bootstrap a brand-new person. id has no DB-side default (cuid is applied
    // by the Prisma client), so generate one here; other columns use their
    // schema defaults.
    const id = randomBytes(16).toString("hex");
    newSecret = randomBytes(24).toString("hex");
    const color = PALETTE[users.length % PALETTE.length];
    db.prepare("INSERT INTO User (id, name, color, webhookSecret, passwordHash) VALUES (?, ?, ?, ?, ?)").run(id, name, color, newSecret, hashPassword(pw));
    console.log(`\n✓ Created ${name} and set their password.`);
  }

  if (newSecret) console.log(`  Webhook token (for Home Assistant): ${newSecret}`);
  db.close();
})();
