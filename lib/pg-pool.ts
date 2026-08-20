import { Pool, type PoolConfig } from "pg";

export function pgPoolConfig(url: string, extra: PoolConfig = {}): PoolConfig {
  const parsed = new URL(url);
  parsed.searchParams.delete("sslmode");
  return {
    connectionString: parsed.toString(),
    ssl: { rejectUnauthorized: false },
    ...extra,
  };
}

export function pgPool(url: string, extra: PoolConfig = {}) {
  return new Pool(pgPoolConfig(url, extra));
}
