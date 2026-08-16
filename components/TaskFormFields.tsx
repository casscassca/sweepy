"use client";
import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import DirtSlider from "@/components/DirtSlider";
import { lastDoneAtFromRatio } from "@/lib/dirtiness";

export const FREQ_OPTIONS = [
  { label: "Daily", days: 1 },
  { label: "Every 2 days", days: 2 },
  { label: "Every 3 days", days: 3 },
  { label: "Weekly", days: 7 },
  { label: "Every 2 weeks", days: 14 },
  { label: "Monthly", days: 30 },
  { label: "Every 2 months", days: 60 },
  { label: "Every 3 months", days: 90 },
  { label: "Every 6 months", days: 180 },
  { label: "Yearly", days: 365 },
];

export type TaskFormUser = { id: string; name: string; color: string };
export type TaskFormTask = {
  id: string;
  name: string;
  difficulty: number;
  frequencyDays: number;
  lastDoneAt: string | null;
  allowedDays: string | null;
  important?: boolean;
  notes?: string;
  assignableUsers: { user: TaskFormUser }[];
};

const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export function parseTaskForm(form: HTMLFormElement) {
  const name = (form.elements.namedItem("name") as HTMLInputElement).value;
  const difficulty = Number((form.elements.namedItem("difficulty") as HTMLSelectElement).value);
  const frequencyDays = Number((form.elements.namedItem("frequencyDays") as HTMLSelectElement).value);
  const selected = Array.from(form.querySelectorAll<HTMLInputElement>("input[name=assignable]:checked")).map((el) => el.value);
  const checkedDays = Array.from(form.querySelectorAll<HTMLInputElement>("input[name=day]:checked")).map((el) => el.value);
  const allowedDays = checkedDays.length === 7 || checkedDays.length === 0 ? null : checkedDays.join(",");
  const dirtRatio = Number((form.elements.namedItem("dirtRatio") as HTMLInputElement).value);
  const lastDone = lastDoneAtFromRatio(dirtRatio, frequencyDays);
  const important = (form.elements.namedItem("important") as HTMLInputElement)?.checked ?? false;
  const notes = ((form.elements.namedItem("notes") as HTMLTextAreaElement)?.value ?? "").trim();
  return {
    name,
    difficulty,
    frequencyDays,
    allowedDays,
    assignableUserIds: selected,
    lastDoneAt: lastDone ? lastDone.toISOString() : null,
    important,
    notes,
  };
}

export default function TaskFormFields({
  task,
  users,
}: {
  task?: TaskFormTask;
  users: TaskFormUser[];
}) {
  const activeDays = task?.allowedDays ? task.allowedDays.split(",").map(Number) : null;
  const [notesOpen, setNotesOpen] = useState(false);
  const hasNotes = Boolean(task?.notes?.trim());

  return (
    <>
      <div>
        <label className="block text-xs mb-1.5" style={{ color: "var(--text3)" }}>Task name</label>
        <input name="name" required defaultValue={task?.name} className="w-full" placeholder="e.g. Wipe counters" />
      </div>
      <label className="flex items-start gap-2.5 text-sm cursor-pointer">
        <input type="checkbox" name="important" defaultChecked={task?.important ?? false} className="mt-0.5" />
        <span>
          Important
          <span className="block text-xs font-normal mt-0.5" style={{ color: "var(--text3)" }}>
            Once due, stays at the top of the list until it’s done
          </span>
        </span>
      </label>
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="block text-xs mb-1.5" style={{ color: "var(--text3)" }}>Difficulty</label>
          <select name="difficulty" defaultValue={task?.difficulty ?? 1} className="w-full">
            <option value={1}>Quick (1 pt)</option>
            <option value={2}>Medium (2 pts)</option>
            <option value={3}>Big job (3 pts)</option>
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-xs mb-1.5" style={{ color: "var(--text3)" }}>Frequency</label>
          <select name="frequencyDays" defaultValue={task?.frequencyDays ?? 7} className="w-full">
            {FREQ_OPTIONS.map((o) => (
              <option key={o.days} value={o.days}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>
      <DirtSlider lastDoneAt={task?.lastDoneAt} frequencyDays={task?.frequencyDays} />
      <div>
        <label className="block text-xs mb-2" style={{ color: "var(--text3)" }}>
          Allowed days <span style={{ color: "var(--text3)" }}>(blank = any day)</span>
        </label>
        <div className="flex gap-1.5 flex-wrap">
          {DAY_LABELS.map((label, i) => {
            const defaultChecked = activeDays ? activeDays.includes(i) : true;
            return (
              <label key={i} className="flex flex-col items-center gap-1 cursor-pointer">
                <input type="checkbox" name="day" value={i} defaultChecked={defaultChecked} className="sr-only peer" />
                <span
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-medium transition-all peer-checked:text-white"
                  style={{
                    background: "var(--surface2)",
                    border: "1px solid var(--border)",
                  }}
                  onClick={(e) => {
                    const input = (e.currentTarget.previousElementSibling as HTMLInputElement);
                    input.checked = !input.checked;
                    const span = e.currentTarget;
                    if (input.checked) {
                      span.style.background = "var(--accent)";
                      span.style.color = "white";
                      span.style.borderColor = "var(--accent)";
                    } else {
                      span.style.background = "var(--surface2)";
                      span.style.color = "";
                      span.style.borderColor = "var(--border)";
                    }
                  }}
                >
                  {label}
                </span>
              </label>
            );
          })}
        </div>
      </div>
      {users.length > 0 && (
        <div>
          <label className="block text-xs mb-2" style={{ color: "var(--text3)" }}>
            Who can do this? <span style={{ color: "var(--text3)" }}>(blank = anyone)</span>
          </label>
          <div className="flex flex-wrap gap-3">
            {users.map((u) => {
              const checked = task?.assignableUsers.some((au) => au.user.id === u.id) ?? false;
              return (
                <label key={u.id} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input type="checkbox" name="assignable" value={u.id} defaultChecked={checked} />
                  <span className="w-2 h-2 rounded-full" style={{ background: u.color }} />
                  {u.name}
                </label>
              );
            })}
          </div>
        </div>
      )}
      <div>
        <button
          type="button"
          onClick={() => setNotesOpen((v) => !v)}
          className="flex items-center gap-1 text-xs"
          style={{ color: "var(--text3)" }}
          aria-expanded={notesOpen}
        >
          {notesOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          Notes
          {hasNotes && !notesOpen && <span style={{ color: "var(--text2)" }}>· added</span>}
        </button>
        <textarea
          name="notes"
          defaultValue={task?.notes ?? ""}
          rows={3}
          maxLength={2000}
          placeholder="Context that stays after this is checked off"
          className={`w-full mt-2 ${notesOpen ? "" : "hidden"}`}
        />
      </div>
    </>
  );
}
