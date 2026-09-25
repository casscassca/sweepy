export type CapacityRow = {
  pinned: boolean;
  held: boolean;
  exclusive: boolean;
  task: { oneOff: boolean; important?: boolean };
};

/** One-offs and exclusive important chores may sit over the cap. */
export function mayExceedCapacity(row: CapacityRow) {
  if (row.task.oneOff) return true;
  if (row.task.important && row.exclusive) return true;
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
    if (a.held !== b.held) return a.held ? 1 : -1;
    if (a.task.important !== b.task.important) return a.task.important ? 1 : -1;
    return a.dirt - b.dirt;
  });
}
