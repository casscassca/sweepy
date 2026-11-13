import { timingSafeEqual } from "crypto";
import { hasAddon, hasAddon2, type AddonFields } from "./addon";
import { calendarDayStr } from "./dates";

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

function doneOn(at: Date | string | null | undefined, today: string) {
  if (!at) return false;
  return calendarDayStr(at) === today;
}

export function linesForCleaner(
  task: AddonFields & { id: string; hideFromCleaner?: boolean; oneOff?: boolean },
  today: string,
): CleanerLine[] {
  if (task.oneOff || task.hideFromCleaner) return [];
  const lines: CleanerLine[] = [{
    taskId: task.id,
    layer: "base",
    name: task.name ?? "",
    done: doneOn(task.lastDoneAt, today),
  }];
  if (hasAddon(task)) {
    lines.push({
      taskId: task.id,
      layer: "addon",
      name: (task.addonName ?? "").trim(),
      done: doneOn(task.addonLastDoneAt, today),
    });
  }
  if (hasAddon2(task)) {
    lines.push({
      taskId: task.id,
      layer: "addon2",
      name: (task.addon2Name ?? "").trim(),
      done: doneOn(task.addon2LastDoneAt, today),
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

export function cleanerCompletionName(
  task: { name?: string | null; addonName?: string | null; addon2Name?: string | null },
  layer: string,
) {
  if (layer === "addon") return (task.addonName ?? "").trim() || task.name || "";
  if (layer === "addon2") return (task.addon2Name ?? "").trim() || task.name || "";
  return task.name ?? "";
}

type StampLog = { id: string; completedAt: Date; layer: string };

export function previousLayerStamp(logsDesc: StampLog[], removedId: string, layer: CleanerLayer): Date | null {
  const match = (row: StampLog) => layer === "base"
    ? row.layer !== "addon" && row.layer !== "addon2"
    : row.layer === layer;
  return logsDesc.find((row) => row.id !== removedId && match(row))?.completedAt ?? null;
}
