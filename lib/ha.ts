/** Sweepy → Home Assistant. One house token, from env — not the DB. */
export function haConfig(): { url: string; token: string } | null {
  const url = (process.env.HA_URL ?? "").trim().replace(/\/$/, "");
  const token = (process.env.HA_TOKEN ?? "").trim();
  if (!url || !token) return null;
  return { url, token };
}
