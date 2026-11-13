import { timingSafeEqual } from "crypto";
import { hasAddon, hasAddon2, isAddon2Due, isAddonDue, type AddonFields } from "./addon";

export type CleanerLayer = "base" | "addon" | "addon2";

export function cleanerCode(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const code = raw.trim();
  return /^\d{4}$/.test(code) ? code : "";
}

export function cleanerCodesMatch(given: unknown, stored: unknown): boolean {
  const a = cleanerCode(given);
  const b = cleanerCode(stored);
  if (!a || !b) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export type CleanerLine = {
  taskId: string;
  layer: CleanerLayer;
  name: string;
  done: boolean;
};

export type CleanerSection = {
  id: string;
  name: string;
  icon: string;
  lines: CleanerLine[];
};

type CleanerRoom = {
  id: string;
  name: string;
  icon: string;
  tasks: AddonFields & { id: string; hideFromCleaner?: boolean; oneOff?: boolean }[];
};

/** First letter only, so "mop floors" becomes "Mop floors". */
export function capitalizeFirst(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return "";
  return trimmed.charAt(0).toLocaleUpperCase() + trimmed.slice(1);
}

export function linesForCleaner(
  task: AddonFields & { id: string; hideFromCleaner?: boolean; oneOff?: boolean },
  _today: string,
): CleanerLine[] {
  if (task.oneOff || task.hideFromCleaner) return [];
  const lines: CleanerLine[] = [
    {
      taskId: task.id,
      layer: "base",
      name: capitalizeFirst(task.name ?? ""),
      done: false,
    },
  ];
  if (hasAddon(task)) {
    lines.push({
      taskId: task.id,
      layer: "addon",
      name: capitalizeFirst(task.addonName ?? ""),
      done: false,
    });
  }
  if (hasAddon2(task)) {
    lines.push({
      taskId: task.id,
      layer: "addon2",
      name: capitalizeFirst(task.addon2Name ?? ""),
      done: false,
    });
  }
  return lines;
}

export function cleanerChecklist(rooms: CleanerRoom[], unassigned: CleanerRoom["tasks"], today: string): CleanerSection[] {
  const sections = rooms.map((room) => ({
    id: room.id,
    name: room.name,
    icon: room.icon,
    lines: room.tasks.flatMap((task) => linesForCleaner(task, today)),
  })).filter((section) => section.lines.length > 0);
  const extra = unassigned.flatMap((task) => linesForCleaner(task, today));
  if (extra.length > 0) sections.push({ id: "other", name: "Other", icon: "", lines: extra });
  return sections;
}

/** Which parts a completion records. Omit `requested` to keep the old “base plus whatever add-on is due” behavior. */
export function completionLayers(task: AddonFields, at: Date, requested?: CleanerLayer[] | null): CleanerLayer[] {
  const allowed = (layer: CleanerLayer) => {
    if (layer === "base") return true;
    if (layer === "addon") return hasAddon(task);
    return hasAddon2(task);
  };
  if (requested && requested.length > 0) return requested.filter(allowed);
  const layers: CleanerLayer[] = ["base"];
  if (isAddonDue(task, at)) layers.push("addon");
  if (isAddon2Due(task, at)) layers.push("addon2");
  return layers;
}

export function cleanerCompletionName(
  task: { name?: string | null; addonName?: string | null; addon2Name?: string | null },
  layer: string,
) {
  if (layer === "addon") return (task.addonName ?? "").trim() || task.name || "";
  if (layer === "addon2") return (task.addon2Name ?? "").trim() || task.name || "";
  return task.name ?? "";
}

/** Undoing the Cleaner's check-off should not leave them an open chore. */
export function reopenAssignmentAfterUndo(assigneeIsCleaner: boolean) {
  return !assigneeIsCleaner;
}

export type CleanerSubmitLine = { taskId: string; layer: CleanerLayer };

/** The lines a cleaner chose, with blanks and repeats dropped. */
export function cleanerSubmitLines(raw: unknown): CleanerSubmitLine[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const lines: CleanerSubmitLine[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as { taskId?: unknown; layer?: unknown };
    const layer = row.layer === "base" || row.layer === "addon" || row.layer === "addon2" ? row.layer : null;
    if (typeof row.taskId !== "string" || !row.taskId.trim() || !layer) continue;
    const key = `${row.taskId}:${layer}`;
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push({ taskId: row.taskId, layer });
  }
  return lines.slice(0, 300);
}

type StampLog = { id: string; completedAt: Date; layer: string };

export function previousLayerStamp(logsDesc: StampLog[], removedId: string, layer: CleanerLayer): Date | null {
  const match = (row: StampLog) => layer === "base"
    ? row.layer !== "addon" && row.layer !== "addon2"
    : row.layer === layer;
  return logsDesc.find((row) => row.id !== removedId && match(row))?.completedAt ?? null;
}
