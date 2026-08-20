import { Pool, type PoolConfig } from "pg";

function isLocalHost(host: string) {
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

export function pgPoolConfig(url: string, extra: PoolConfig = {}): PoolConfig {
  const parsed = new URL(url);
  parsed.searchParams.delete("sslmode");
  return {
    connectionString: parsed.toString(),
    ssl: isLocalHost(parsed.hostname) ? false : { rejectUnauthorized: false },
    ...extra,
  };
}

export function pgPool(url: string, extra: PoolConfig = {}) {
  return new Pool(pgPoolConfig(url, extra));
}
