import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createClient() {
  const dbUrl = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
  const dbPath = dbUrl.replace(/^file:/, "");
  const absolutePath = path.isAbsolute(dbPath) ? dbPath : path.join(process.cwd(), dbPath);
  const adapter = new PrismaBetterSqlite3({ url: absolutePath });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new PrismaClient({ adapter } as any);
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
