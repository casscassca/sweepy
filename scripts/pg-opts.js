function pgOpts(url, extra = {}) {
  const parsed = new URL(url);
  parsed.searchParams.delete("sslmode");
  const host = parsed.hostname;
  const local = host === "localhost" || host === "127.0.0.1" || host === "::1";
  return {
    connectionString: parsed.toString(),
    max: 2,
    ssl: local ? false : { rejectUnauthorized: false },
    ...extra,
  };
}

module.exports = { pgOpts };
