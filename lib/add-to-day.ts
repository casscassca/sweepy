/** Who a catalog add should use, and whether an existing row should move to them. */
export function catalogAddAssignee(bodyUserId: unknown, sessionUserId: string | null | undefined) {
  const explicit = typeof bodyUserId === "string" && bodyUserId.trim() ? bodyUserId.trim() : undefined;
  return {
    userId: explicit ?? (sessionUserId || undefined),
    reassign: Boolean(explicit),
  };
}

/**
 * New rows use the preferred person when they can do the chore, otherwise the
 * first person who can. An existing row stays put unless this add named a
 * person who is allowed to do it.
 */
export function pickAddAssignee(opts: {
  preferredUserId?: string;
  allowedIds: string[];
  currentUserId?: string;
  reassign?: boolean;
}) {
  const preferredOk = Boolean(opts.preferredUserId && opts.allowedIds.includes(opts.preferredUserId));
  if (opts.currentUserId) {
    if (opts.reassign && preferredOk) return opts.preferredUserId;
    return opts.currentUserId;
  }
  if (preferredOk) return opts.preferredUserId;
  return opts.allowedIds[0];
}
