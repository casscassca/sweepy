import { randomBytes, scryptSync, createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";

export const COOKIE_NAME = "sweepy_session";
export const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

// ---- Password hashing (scrypt; format "scrypt:<saltHex>:<hashHex>") ----

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt:${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string | null): boolean {
  if (!stored) return false;
  const [scheme, saltHex, hashHex] = stored.split(":");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, Buffer.from(saltHex, "hex"), expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

// ---- Per-user webhook secret ----

export function generateWebhookSecret(): string {
  return randomBytes(24).toString("hex");
}

// ---- Session signing secret (stored in DB so it survives deploys) ----

let cachedSecret: string | null = null;

export async function getSessionSecret(): Promise<string> {
  if (cachedSecret) return cachedSecret;
  let settings = await prisma.settings.findUnique({ where: { id: "singleton" } });
  if (!settings) settings = await prisma.settings.create({ data: { id: "singleton" } });
  if (!settings.sessionSecret) {
    settings = await prisma.settings.update({
      where: { id: "singleton" },
      data: { sessionSecret: randomBytes(32).toString("hex") },
    });
  }
  cachedSecret = settings.sessionSecret;
  return cachedSecret;
}

// ---- Stateless session token: "<payloadB64>.<hmacB64>" ----

export async function createSessionToken(userId: string): Promise<string> {
  const secret = await getSessionSecret();
  const exp = Date.now() + SESSION_TTL_SECONDS * 1000;
  const payload = Buffer.from(JSON.stringify({ uid: userId, exp })).toString("base64url");
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export async function verifySessionToken(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const secret = await getSessionSecret();
  const expected = createHmac("sha256", secret).update(payload).digest("base64url");
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as { uid?: string; exp?: number };
    if (!data.uid || !data.exp || Date.now() > data.exp) return null;
    return data.uid;
  } catch {
    return null;
  }
}
