import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient; prismaRev?: number };
const PRISMA_REV = 12;

function createClient() {
  const dbUrl = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
  const dbPath = dbUrl.replace(/^file:/, "");
  const absolutePath = path.isAbsolute(dbPath) ? dbPath : path.join(process.cwd(), dbPath);
  const adapter = new PrismaBetterSqlite3({ url: absolutePath });
  // Never return these secrets unless a query explicitly opts back in with
  // `omit: { passwordHash: false }`. Guards against accidental leaks via any
  // route that returns a User (directly or through an `include`).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new PrismaClient({ adapter, omit: { user: { passwordHash: true, webhookSecret: true } } } as any);
}

const cached = globalForPrisma.prisma;
const stale = globalForPrisma.prismaRev !== PRISMA_REV
  || (Boolean(cached) && typeof (cached as { integrationLog?: unknown }).integrationLog === "undefined");
export const prisma: PrismaClient = !cached || stale ? createClient() : cached;

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaRev = PRISMA_REV;
}
