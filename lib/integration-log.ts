import { prisma } from "./prisma";

const KEEP = 80;

export async function appendIntegrationLog(entry: {
  kind: "notify" | "webhook";
  ok: boolean;
  userName?: string;
  summary: string;
  detail?: string;
}) {
  const log = prisma.integrationLog;
  if (!log) {
    console.warn("[ha-log] client is stale — restart npm run dev");
    return;
  }
  try {
    await log.create({
      data: {
        kind: entry.kind,
        ok: entry.ok,
        userName: entry.userName ?? "",
        summary: entry.summary,
        detail: entry.detail ?? "",
      },
    });
    const extra = await log.findMany({
      orderBy: { createdAt: "desc" },
      skip: KEEP,
      select: { id: true },
    });
    if (extra.length > 0) {
      await log.deleteMany({ where: { id: { in: extra.map((r) => r.id) } } });
    }
  } catch (err) {
    console.error("[ha-log] write failed", err);
  }
}
