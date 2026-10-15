export type CapacityRow = {
  pinned: boolean;
  held: boolean;
  exclusive: boolean;
  task: { oneOff: boolean; important?: boolean };
};

/**
 * One-offs and important chores may sit over the cap.
 * Pins count toward the cap and are kept by canSpillForCapacity.
 */
export function mayExceedCapacity(row: CapacityRow) {
  if (row.task.oneOff) return true;
  if (row.task.important) return true;
  return false;
}

export function canSpillForCapacity(row: CapacityRow) {
  if (row.pinned) return false;
  return !mayExceedCapacity(row);
}

export function keepsDueDay(row: CapacityRow) {
  return row.task.important === true;
}

export function rankForSpill<T extends CapacityRow & { dirt: number }>(rows: T[]) {
  return [...rows].sort((a, b) => {
    const aSticky = a.pinned || a.task.important ? 1 : 0;
    const bSticky = b.pinned || b.task.important ? 1 : 0;
    if (aSticky !== bSticky) return aSticky - bSticky;
    if (a.held !== b.held) return a.held ? 1 : -1;
    return a.dirt - b.dirt;
  });
}
