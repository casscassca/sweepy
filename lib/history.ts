export type HistoryStamp = { at: Date; id: string };

/** Newest first, one page, from completions and cleaner notes fetched the same way. */
export function mergeHistoryPage<C extends HistoryStamp, N extends HistoryStamp>(completions: C[], notes: N[], pageSize: number) {
  const merged = [...completions, ...notes].sort((a, b) => {
    const byTime = b.at.getTime() - a.at.getTime();
    if (byTime !== 0) return byTime;
    return a.id < b.id ? 1 : -1;
  });
  return {
    page: merged.slice(0, pageSize),
    hasMore: merged.length > pageSize,
  };
}
