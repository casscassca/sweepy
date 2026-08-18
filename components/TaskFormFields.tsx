"use client";
import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import DirtSlider from "@/components/DirtSlider";
import { lastDoneAtFromRatio } from "@/lib/dirtiness";
import { daysForFrequency, FREQ_UNITS, splitFrequency, type FreqUnit } from "@/lib/frequency";

export { formatFrequency } from "@/lib/frequency";

export type TaskFormUser = { id: string; name: string; color: string };
export type TaskFormTask = {
  id: string;
  name: string;
  difficulty: number;
  frequencyDays: number;
  lastDoneAt: string | null;
  allowedDays: string | null;
  important?: boolean;
  dueOnly?: boolean;
  notes?: string;
  addonName?: string;
  addonFrequencyDays?: number;
  addonPoints?: number;
  addonLastDoneAt?: string | null;
  assignableUsers: { user: TaskFormUser }[];
};

const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export function parseTaskForm(form: HTMLFormElement) {
  const name = (form.elements.namedItem("name") as HTMLInputElement).value;
  const difficulty = Number((form.elements.namedItem("difficulty") as HTMLSelectElement).value);
  const freqCount = Number((form.elements.namedItem("freqCount") as HTMLInputElement).value);
  const freqUnit = ((form.elements.namedItem("freqUnit") as HTMLSelectElement).value || "week") as FreqUnit;
  const frequencyDays = daysForFrequency(freqCount, freqUnit);
  const selected = Array.from(form.querySelectorAll<HTMLInputElement>("input[name=assignable]:checked")).map((el) => el.value);
  const checkedDays = Array.from(form.querySelectorAll<HTMLInputElement>("input[name=day]:checked")).map((el) => el.value);
  const allowedDays = checkedDays.length === 7 || checkedDays.length === 0 ? null : checkedDays.join(",");
  const dirtRatio = Number((form.elements.namedItem("dirtRatio") as HTMLInputElement).value);
  const lastDone = lastDoneAtFromRatio(dirtRatio, frequencyDays);
  const important = (form.elements.namedItem("important") as HTMLInputElement)?.checked ?? false;
  const dueOnly = (form.elements.namedItem("dueOnly") as HTMLInputElement)?.checked ?? false;
  const notes = ((form.elements.namedItem("notes") as HTMLTextAreaElement)?.value ?? "").trim();
  const addonOn = (form.elements.namedItem("addonOn") as HTMLInputElement)?.checked ?? false;
  const addonName = addonOn ? ((form.elements.namedItem("addonName") as HTMLInputElement)?.value ?? "").trim() : "";
  const addonFreqCount = Number((form.elements.namedItem("addonFreqCount") as HTMLInputElement)?.value);
  const addonFreqUnit = ((form.elements.namedItem("addonFreqUnit") as HTMLSelectElement)?.value || "week") as FreqUnit;
  const addonFrequencyDays = addonOn && addonName ? daysForFrequency(addonFreqCount, addonFreqUnit) : 0;
  const addonPoints = addonOn ? Math.min(2, Math.max(1, Number((form.elements.namedItem("addonPoints") as HTMLSelectElement)?.value) || 1)) : 1;
  const addonDirtRatio = Number((form.elements.namedItem("addonDirtRatio") as HTMLInputElement)?.value);
  const addonLast = addonOn && addonName && addonFrequencyDays
    ? lastDoneAtFromRatio(Number.isFinite(addonDirtRatio) ? addonDirtRatio : 0, addonFrequencyDays)
    : null;
  return {
    name,
    difficulty,
    frequencyDays,
    allowedDays,
    assignableUserIds: selected,
    lastDoneAt: lastDone ? lastDone.toISOString() : null,
    important,
    dueOnly,
    notes,
    addonName,
    addonFrequencyDays,
    addonPoints,
    addonLastDoneAt: addonLast ? addonLast.toISOString() : null,
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
  const initialFreq = splitFrequency(task?.frequencyDays ?? 7);
  const [freqCount, setFreqCount] = useState(initialFreq.count);
  const [freqUnit, setFreqUnit] = useState<FreqUnit>(initialFreq.unit);
  const frequencyDays = useMemo(() => daysForFrequency(freqCount, freqUnit), [freqCount, freqUnit]);
  const [notesOpen, setNotesOpen] = useState(false);
  const hasNotes = Boolean(task?.notes?.trim());
  const [taskName, setTaskName] = useState(task?.name ?? "");
  const [difficulty, setDifficulty] = useState(task?.difficulty ?? 1);
  const [addonOn, setAddonOn] = useState(Boolean(task?.addonName?.trim()));
  const initialAddonFreq = splitFrequency(task?.addonFrequencyDays && task.addonFrequencyDays > 0 ? task.addonFrequencyDays : 21);
  const [addonFreqCount, setAddonFreqCount] = useState(initialAddonFreq.count);
  const [addonFreqUnit, setAddonFreqUnit] = useState<FreqUnit>(initialAddonFreq.unit);
  const [addonName, setAddonName] = useState(task?.addonName ?? "");
  const [addonPoints, setAddonPoints] = useState(task?.addonPoints && task.addonPoints > 0 ? task.addonPoints : 1);
  const addonFrequencyDays = useMemo(() => daysForFrequency(addonFreqCount, addonFreqUnit), [addonFreqCount, addonFreqUnit]);
  const comboName = `${taskName.trim() || "This"} and ${addonName.trim() || "…"}`;
  const comboPts = Math.min(3, difficulty + addonPoints);

  return (
    <>
      <div>
        <label className="block text-xs mb-1.5" style={{ color: "var(--text3)" }}>Task name</label>
        <input name="name" required value={taskName} onChange={(e) => setTaskName(e.target.value)} className="w-full" placeholder="e.g. Vacuum living room" />
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
      <label className="flex items-start gap-2.5 text-sm cursor-pointer">
        <input type="checkbox" name="dueOnly" defaultChecked={task?.dueOnly ?? false} className="mt-0.5" />
        <span>
          Only when due
          <span className="block text-xs font-normal mt-0.5" style={{ color: "var(--text3)" }}>
            Shows on the due day — won’t get pulled forward to fill an earlier list
          </span>
        </span>
      </label>
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="block text-xs mb-1.5" style={{ color: "var(--text3)" }}>Difficulty</label>
          <select name="difficulty" value={difficulty} onChange={(e) => setDifficulty(Number(e.target.value))} className="w-full">
            <option value={1}>Quick (1 pt)</option>
            <option value={2}>Medium (2 pts)</option>
            <option value={3}>Big job (3 pts)</option>
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-xs mb-1.5" style={{ color: "var(--text3)" }}>Every</label>
          <div className="flex gap-2">
            <div className="w-16 shrink-0">
              <input
                name="freqCount"
                type="number"
                min={1}
                max={99}
                required
                value={freqCount}
                onChange={(e) => setFreqCount(Math.max(1, Math.min(99, Number(e.target.value) || 1)))}
              />
            </div>
            <select
              name="freqUnit"
              value={freqUnit}
              onChange={(e) => setFreqUnit(e.target.value as FreqUnit)}
              className="flex-1 min-w-0"
            >
              {FREQ_UNITS.map((u) => (
                <option key={u.value} value={u.value}>{freqCount === 1 ? u.singular : u.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
      <DirtSlider key={frequencyDays} lastDoneAt={task?.lastDoneAt} frequencyDays={frequencyDays} />
      <label className="flex items-start gap-2.5 text-sm cursor-pointer">
        <input type="checkbox" name="addonOn" checked={addonOn} onChange={(e) => setAddonOn(e.target.checked)} className="mt-0.5" />
        <span>
          Also when due
          <span className="block text-xs font-normal mt-0.5" style={{ color: "var(--text3)" }}>
            Upgrade this row — Vacuum becomes Vacuum and mop
          </span>
        </span>
      </label>
      {addonOn && (
        <div
          className="rounded-xl p-3 space-y-3"
          style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}
        >
          <div>
            <label className="block text-xs mb-1.5" style={{ color: "var(--text3)" }}>Add-on name</label>
            <input name="addonName" value={addonName} onChange={(e) => setAddonName(e.target.value)} className="w-full" placeholder="e.g. mop" />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs mb-1.5" style={{ color: "var(--text3)" }}>Every</label>
              <div className="flex gap-2">
                <div className="w-16 shrink-0">
                  <input
                    name="addonFreqCount"
                    type="number"
                    min={1}
                    max={99}
                    value={addonFreqCount}
                    onChange={(e) => setAddonFreqCount(Math.max(1, Math.min(99, Number(e.target.value) || 1)))}
                  />
                </div>
                <select
                  name="addonFreqUnit"
                  value={addonFreqUnit}
                  onChange={(e) => setAddonFreqUnit(e.target.value as FreqUnit)}
                  className="flex-1 min-w-0"
                >
                  {FREQ_UNITS.map((u) => (
                    <option key={u.value} value={u.value}>{addonFreqCount === 1 ? u.singular : u.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="w-24 shrink-0">
              <label className="block text-xs mb-1.5" style={{ color: "var(--text3)" }}>Extra</label>
              <select name="addonPoints" value={addonPoints} onChange={(e) => setAddonPoints(Number(e.target.value))} className="w-full">
                <option value={1}>+1 pt</option>
                <option value={2}>+2 pts</option>
              </select>
            </div>
          </div>
          <p className="text-xs leading-relaxed" style={{ color: "var(--text2)" }}>
            Usually <span className="font-medium" style={{ color: "var(--text)" }}>{taskName.trim() || "this"} · {difficulty} pt</span>
            <br />
            When {addonName.trim() || "the add-on"} is due: <span className="font-medium" style={{ color: "var(--text)" }}>{comboName} · {comboPts} pts</span>
          </p>
          <DirtSlider
            key={addonFrequencyDays}
            lastDoneAt={task?.addonLastDoneAt ?? task?.lastDoneAt ?? null}
            frequencyDays={addonFrequencyDays}
            name="addonDirtRatio"
            inputId="addon-dirt-ratio"
            label={`How long since ${addonName.trim() || "the add-on"}?`}
          />
        </div>
      )}
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
