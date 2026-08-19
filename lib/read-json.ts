export async function readJson<T>(res: Response, fallback: T): Promise<T> {
  if (!res.ok) return fallback;
  try {
    const data: unknown = await res.json();
    return (data ?? fallback) as T;
  } catch {
    return fallback;
  }
}
