"use client";
import { useEffect, useMemo, useState } from "react";
import { Check, Plus, Search } from "lucide-react";

type User = { id: string; name: string; color: string };
type CatalogTask = { id: string; name: string; difficulty: number };
type Room = { id: string; name: string; icon: string; tasks: CatalogTask[] };

const DIFF = [
  { value: 1, label: "quick" },
  { value: 2, label: "medium" },
  { value: 3, label: "big" },
];

export default function AddToDaySheet({
  date,
  title,
  users,
  defaultUserId,
  onClose,
  onAdded,
}: {
  date: string;
  title: string;
  users: User[];
  defaultUserId?: string;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [onDay, setOnDay] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [addingId, setAddingId] = useState<string | null>(null);
  const [oneOffName, setOneOffName] = useState("");
  const [oneOffUserId, setOneOffUserId] = useState(defaultUserId ?? users[0]?.id ?? "");
  const [oneOffDiff, setOneOffDiff] = useState(1);
  const [savingOneOff, setSavingOneOff] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/rooms").then((r) => r.json()),
      fetch(`/api/assignments?date=${date}&peek=1`).then((r) => r.json()),
    ]).then(([r, a]) => {
      setRooms(Array.isArray(r) ? r : []);
      setOnDay(new Set((Array.isArray(a) ? a : []).map((x: { task: { id: string } }) => x.task.id)));
    });
  }, [date]);

  useEffect(() => {
    if (!oneOffUserId && (defaultUserId || users[0])) {
      setOneOffUserId(defaultUserId ?? users[0].id);
    }
  }, [defaultUserId, users, oneOffUserId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rooms;
    return rooms
      .map((room) => ({
        ...room,
        tasks: room.tasks.filter((t) => t.name.toLowerCase().includes(q) || room.name.toLowerCase().includes(q)),
      }))
      .filter((room) => room.tasks.length > 0);
  }, [rooms, query]);

  async function addCatalog(taskId: string) {
    if (onDay.has(taskId) || addingId) return;
    setAddingId(taskId);
    const res = await fetch("/api/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId, date }),
    });
    if (res.ok) {
      setOnDay((prev) => new Set(prev).add(taskId));
      onAdded();
    }
    setAddingId(null);
  }

  async function addOneOff(e: React.FormEvent) {
    e.preventDefault();
    if (!oneOffName.trim() || !oneOffUserId || savingOneOff) return;
    setSavingOneOff(true);
    const res = await fetch("/api/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        oneOff: true,
        name: oneOffName,
        userId: oneOffUserId,
        difficulty: oneOffDiff,
        date,
      }),
    });
    setSavingOneOff(false);
    if (res.ok) onAdded();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: "rgba(0,0,0,0.4)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-5"
        style={{ background: "var(--surface)", boxShadow: "var(--shadow)" }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="add-to-day-title"
      >
        <h2 id="add-to-day-title" className="font-semibold text-lg mb-3">{title}</h2>

        <form onSubmit={addOneOff} className="space-y-3 mb-5">
          <p className="text-sm font-medium">One-off</p>
          <input
            autoFocus
            value={oneOffName}
            onChange={(e) => setOneOffName(e.target.value)}
            className="w-full"
            placeholder="e.g. Take out recycling"
            required
          />
          <div>
            <p className="text-xs mb-1.5" style={{ color: "var(--text3)" }}>Who</p>
            <div className="flex flex-wrap gap-2">
              {users.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => setOneOffUserId(u.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium"
                  style={{
                    background: oneOffUserId === u.id ? u.color + "22" : "var(--surface2)",
                    color: oneOffUserId === u.id ? u.color : "var(--text2)",
                    border: `2px solid ${oneOffUserId === u.id ? u.color : "transparent"}`,
                  }}
                >
                  <span className="w-2 h-2 rounded-full" style={{ background: u.color }} />
                  {u.name}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs mb-1.5" style={{ color: "var(--text3)" }}>Size</p>
            <div className="flex gap-2">
              {DIFF.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => setOneOffDiff(d.value)}
                  className="flex-1 px-3 py-1.5 rounded-xl text-sm font-medium"
                  style={{
                    background: oneOffDiff === d.value ? "var(--accent-dim)" : "var(--surface2)",
                    color: oneOffDiff === d.value ? "var(--accent)" : "var(--text2)",
                    border: `2px solid ${oneOffDiff === d.value ? "var(--accent)" : "transparent"}`,
                  }}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={savingOneOff}
              className="px-4 py-2 rounded-xl text-sm font-medium text-white"
              style={{ background: "var(--accent)" }}
            >
              {savingOneOff ? "Adding…" : "Add one-off"}
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-sm" style={{ color: "var(--text3)" }}>
              Cancel
            </button>
          </div>
        </form>

        <div className="pt-4" style={{ borderTop: "1px solid var(--border)" }}>
          <p className="text-sm font-medium mb-3">Or pick a chore</p>
          <label className="relative block mb-3">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text3)" }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full"
              style={{ paddingLeft: 36 }}
              placeholder="Search chores…"
              aria-label="Search chores"
            />
          </label>

          <div className="space-y-3">
            {filtered.length === 0 && (
              <p className="text-sm py-4 text-center" style={{ color: "var(--text3)" }}>
                {query ? "No matching chores" : "No catalog chores yet"}
              </p>
            )}
            {filtered.map((room) => (
              <div key={room.id}>
                <p className="text-xs font-medium mb-1.5" style={{ color: "var(--text3)" }}>
                  {room.icon} {room.name}
                </p>
                <div className="space-y-1">
                  {room.tasks.map((task) => {
                    const added = onDay.has(task.id);
                    return (
                      <button
                        key={task.id}
                        type="button"
                        onClick={() => addCatalog(task.id)}
                        disabled={added || addingId === task.id}
                        className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl text-left text-sm"
                        style={{
                          background: "var(--surface2)",
                          color: added ? "var(--text3)" : "var(--text)",
                        }}
                      >
                        <span className="flex-1 min-w-0 truncate">{task.name}</span>
                        {added
                          ? <Check size={16} style={{ color: "var(--green)" }} />
                          : <Plus size={16} style={{ color: "var(--text3)" }} />}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
