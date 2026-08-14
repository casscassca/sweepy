"use client";
import { useEffect, useState } from "react";
import { Pencil, Trash2, Plus, ChevronDown, ChevronRight } from "lucide-react";

type User = { id: string; name: string; color: string };
type Task = {
  id: string;
  name: string;
  difficulty: number;
  frequencyDays: number;
  allowedDays: string | null;
  assignableUsers: { user: User }[];
};
type Room = { id: string; name: string; icon: string; tasks: Task[] };

const FREQ_OPTIONS = [
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

const DIFF = [
  { value: 1, label: "Quick", color: "#a78bfa" },
  { value: 2, label: "Medium", color: "#fb923c" },
  { value: 3, label: "Big job", color: "#f87171" },
];

function freqLabel(days: number) {
  return FREQ_OPTIONS.find((o) => o.days === days)?.label ?? `Every ${days} days`;
}

function DiffBadge({ n }: { n: number }) {
  const d = DIFF[n - 1];
  return (
    <span
      className="text-xs font-medium px-1.5 py-0.5 rounded-full"
      style={{ background: d.color + "22", color: d.color }}
    >
      {d.label}
    </span>
  );
}

export default function RoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showRoomForm, setShowRoomForm] = useState(false);
  const [roomName, setRoomName] = useState("");
  const [roomIcon, setRoomIcon] = useState("🏠");
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [taskForms, setTaskForms] = useState<Record<string, boolean>>({});
  const [editingTask, setEditingTask] = useState<(Task & { roomId: string }) | null>(null);

  async function load() {
    const [r, u] = await Promise.all([
      fetch("/api/rooms").then((r) => r.json()),
      fetch("/api/users").then((r) => r.json()),
    ]);
    setRooms(r);
    setUsers(u);
  }

  useEffect(() => { load(); }, []);

  async function saveRoom(e: React.FormEvent) {
    e.preventDefault();
    if (editingRoom) {
      await fetch(`/api/rooms/${editingRoom.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: roomName, icon: roomIcon }),
      });
      setEditingRoom(null);
    } else {
      await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: roomName, icon: roomIcon }),
      });
    }
    setRoomName(""); setRoomIcon("🏠"); setShowRoomForm(false);
    load();
  }

  async function deleteRoom(id: string) {
    if (!confirm("Delete this room and all its tasks?")) return;
    await fetch(`/api/rooms/${id}`, { method: "DELETE" });
    load();
  }

  async function saveTask(e: React.FormEvent, roomId: string) {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const name = (form.elements.namedItem("name") as HTMLInputElement).value;
    const difficulty = Number((form.elements.namedItem("difficulty") as HTMLSelectElement).value);
    const frequencyDays = Number((form.elements.namedItem("frequencyDays") as HTMLSelectElement).value);
    const selected = Array.from(form.querySelectorAll<HTMLInputElement>("input[name=assignable]:checked")).map((el) => el.value);
    const checkedDays = Array.from(form.querySelectorAll<HTMLInputElement>("input[name=day]:checked")).map((el) => el.value);
    const allowedDays = checkedDays.length === 7 || checkedDays.length === 0 ? null : checkedDays.join(",");

    if (editingTask) {
      await fetch(`/api/tasks/${editingTask.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, difficulty, frequencyDays, allowedDays, assignableUserIds: selected }),
      });
      setEditingTask(null);
    } else {
      await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, roomId, difficulty, frequencyDays, allowedDays, assignableUserIds: selected }),
      });
      setTaskForms((f) => ({ ...f, [roomId]: false }));
    }
    load();
  }

  async function deleteTask(id: string) {
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    load();
  }

  const isRoomFormOpen = showRoomForm || !!editingRoom;

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Rooms & Tasks</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text2)" }}>
            {rooms.length} rooms · {rooms.reduce((s, r) => s + r.tasks.length, 0)} tasks
          </p>
        </div>
        <button
          onClick={() => { setShowRoomForm(true); setEditingRoom(null); setRoomName(""); setRoomIcon("🏠"); }}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium text-white transition-colors shrink-0"
          style={{ background: "var(--accent)" }}
        >
          <Plus size={14} /> Add Room
        </button>
      </div>

      {isRoomFormOpen && (
        <form
          onSubmit={saveRoom}
          className="mb-5 p-4 rounded-2xl flex flex-col sm:flex-row gap-3 sm:items-end"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <div>
            <label className="block text-xs mb-1.5" style={{ color: "var(--text3)" }}>Icon</label>
            <input
              value={roomIcon}
              onChange={(e) => setRoomIcon(e.target.value)}
              className="w-12 text-xl text-center"
              maxLength={2}
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs mb-1.5" style={{ color: "var(--text3)" }}>Room name</label>
            <input
              autoFocus
              required
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              className="w-full"
              placeholder="e.g. Kitchen"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 rounded-xl text-sm font-medium text-white"
            style={{ background: "var(--accent)" }}
          >
            {editingRoom ? "Save" : "Add"}
          </button>
          <button
            type="button"
            onClick={() => { setShowRoomForm(false); setEditingRoom(null); }}
            className="px-3 py-2 rounded-xl text-sm"
            style={{ color: "var(--text3)" }}
          >
            Cancel
          </button>
        </form>
      )}

      <div className="space-y-2">
        {rooms.map((room) => (
          <div
            key={room.id}
            className="rounded-2xl overflow-hidden"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            {/* Room header */}
            <div
              className="flex items-center gap-3 px-4 py-3.5 cursor-pointer select-none group"
              onClick={() => setExpanded((e) => ({ ...e, [room.id]: !e[room.id] }))}
            >
              <span className="text-xl shrink-0">{room.icon}</span>
              <span className="font-medium flex-1">{room.name}</span>
              <span className="text-xs mr-1" style={{ color: "var(--text3)" }}>
                {room.tasks.length} {room.tasks.length === 1 ? "task" : "tasks"}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); setEditingRoom(room); setRoomName(room.name); setRoomIcon(room.icon); setShowRoomForm(false); }}
                className="p-2 rounded-lg opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                style={{ color: "var(--text3)" }}
                aria-label="Edit room"
              >
                <Pencil size={13} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); deleteRoom(room.id); }}
                className="p-2 rounded-lg opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                aria-label="Delete room"
                style={{ color: "var(--red)" }}
              >
                <Trash2 size={13} />
              </button>
              {expanded[room.id]
                ? <ChevronDown size={14} style={{ color: "var(--text3)" }} />
                : <ChevronRight size={14} style={{ color: "var(--text3)" }} />
              }
            </div>

            {expanded[room.id] && (
              <div style={{ borderTop: "1px solid var(--border)" }}>
                {room.tasks.map((task) => (
                  <div key={task.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    {editingTask?.id === task.id ? (
                      <form onSubmit={(e) => saveTask(e, room.id)} className="p-4 space-y-3">
                        <TaskFormFields task={task} users={users} freqOptions={FREQ_OPTIONS} />
                        <div className="flex gap-2">
                          <button type="submit" className="px-3 py-1.5 rounded-lg text-sm font-medium text-white" style={{ background: "var(--accent)" }}>Save</button>
                          <button type="button" onClick={() => setEditingTask(null)} className="px-3 py-1.5 rounded-lg text-sm" style={{ color: "var(--text3)" }}>Cancel</button>
                        </div>
                      </form>
                    ) : (
                      <div className="flex items-center gap-3 px-4 py-3 group/task">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium">{task.name}</div>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <DiffBadge n={task.difficulty} />
                            <span className="text-xs" style={{ color: "var(--text3)" }}>{freqLabel(task.frequencyDays)}</span>
                            {task.allowedDays && (
                              <span className="text-xs" style={{ color: "var(--text3)" }}>{formatAllowedDays(task.allowedDays)}</span>
                            )}
                            {task.assignableUsers.length > 0 && (
                              <span className="text-xs" style={{ color: "var(--text3)" }}>
                                → {task.assignableUsers.map((au) => au.user.name).join(", ")}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1 opacity-100 md:opacity-0 md:group-hover/task:opacity-100 transition-opacity">
                          <button onClick={() => setEditingTask({ ...task, roomId: room.id })} className="p-2 rounded-lg" style={{ color: "var(--text3)" }} aria-label="Edit task"><Pencil size={13} /></button>
                          <button onClick={() => deleteTask(task.id)} className="p-2 rounded-lg" style={{ color: "var(--red)" }} aria-label="Delete task"><Trash2 size={13} /></button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {taskForms[room.id] ? (
                  <form onSubmit={(e) => saveTask(e, room.id)} className="p-4 space-y-3">
                    <TaskFormFields users={users} freqOptions={FREQ_OPTIONS} />
                    <div className="flex gap-2">
                      <button type="submit" className="px-3 py-1.5 rounded-lg text-sm font-medium text-white" style={{ background: "var(--accent)" }}>Add Task</button>
                      <button type="button" onClick={() => setTaskForms((f) => ({ ...f, [room.id]: false }))} className="px-3 py-1.5 rounded-lg text-sm" style={{ color: "var(--text3)" }}>Cancel</button>
                    </div>
                  </form>
                ) : (
                  <button
                    onClick={() => setTaskForms((f) => ({ ...f, [room.id]: true }))}
                    className="flex items-center gap-2 px-4 py-3 w-full text-sm transition-colors hover:bg-white/3"
                    style={{ color: "var(--text3)" }}
                  >
                    <Plus size={13} /> Add task
                  </button>
                )}
              </div>
            )}
          </div>
        ))}

        {rooms.length === 0 && (
          <div className="text-center py-20" style={{ color: "var(--text2)" }}>
            <p className="text-4xl mb-3">🏠</p>
            <p className="font-medium">No rooms yet</p>
            <p className="text-sm mt-1" style={{ color: "var(--text3)" }}>Add a room to get started</p>
          </div>
        )}
      </div>
    </div>
  );
}

const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const DAY_FULL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatAllowedDays(allowedDays: string): string {
  const days = allowedDays.split(",").map(Number).sort();
  if (days.length === 7) return "";
  return days.map((d) => DAY_FULL[d]).join(", ");
}

function TaskFormFields({
  task,
  users,
  freqOptions,
}: {
  task?: Task;
  users: User[];
  freqOptions: { label: string; days: number }[];
}) {
  const activeDays = task?.allowedDays ? task.allowedDays.split(",").map(Number) : null;

  return (
    <>
      <div>
        <label className="block text-xs mb-1.5" style={{ color: "var(--text3)" }}>Task name</label>
        <input name="name" required defaultValue={task?.name} className="w-full" placeholder="e.g. Wipe counters" />
      </div>
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
            {freqOptions.map((o) => (
              <option key={o.days} value={o.days}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>
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
    </>
  );
}
