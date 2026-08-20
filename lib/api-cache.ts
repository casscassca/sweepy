import { readJson } from "./read-json";

type Row = { data: unknown; at: number };

const TTL_MS = 60_000;
const rows = new Map<string, Row>();
const pending = new Map<string, Promise<unknown>>();

export function peekApi<T>(url: string): T | undefined {
  const row = rows.get(url);
  if (!row) return undefined;
  return row.data as T;
}

export function clearApiCache() {
  rows.clear();
  pending.clear();
}

export function invalidateApi(...prefixes: string[]) {
  for (const [url, row] of rows) {
    if (prefixes.length === 0 || prefixes.some((prefix) => url === prefix || url.startsWith(prefix))) {
      row.at = 0;
    }
  }
}

export function invalidateLists() {
  invalidateApi("/api/assignments", "/api/upcoming", "/api/rooms", "/api/load", "/api/stats", "/api/history");
}

async function pull<T>(url: string, fallback: T): Promise<T> {
  const inflight = pending.get(url);
  if (inflight) return inflight as Promise<T>;
  const req = (async () => {
    const res = await fetch(url);
    const data = await readJson<T>(res, fallback);
    if (res.ok) rows.set(url, { data, at: Date.now() });
    return data;
  })();
  pending.set(url, req);
  try {
    return await (req as Promise<T>);
  } finally {
    pending.delete(url);
  }
}

export async function getJson<T>(url: string, fallback: T): Promise<T> {
  const row = rows.get(url);
  if (row && Date.now() - row.at < TTL_MS) return row.data as T;
  return pull(url, fallback);
}

export async function loadJson<T>(url: string, fallback: T, apply: (data: T) => void): Promise<T> {
  const cached = peekApi<T>(url);
  if (cached !== undefined) apply(cached);
  const data = await getJson(url, fallback);
  apply(data);
  return data;
}
