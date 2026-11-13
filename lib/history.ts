export type HistoryStamp = { at: Date; id: string };

/** The two household people a shared “Both” credit stands for. The Cleaner is not one of them. */
export function bothHistoryPeople<T extends { cleaner?: boolean }>(users: T[]): T[] {
  return users.filter((user) => !user.cleaner).slice(0, 2);
}

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
