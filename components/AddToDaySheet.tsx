"use client";
import { useEffect, useMemo, useState } from "react";
import { Check, Plus, Search } from "lucide-react";
import { readJson } from "@/lib/read-json";

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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [oneOffUserId, setOneOffUserId] = useState(defaultUserId ?? users[0]?.id ?? "");
  const [oneOffDiff, setOneOffDiff] = useState(1);
  const [composingOneOff, setComposingOneOff] = useState(false);
  const [savingOneOff, setSavingOneOff] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/rooms").then((res) => readJson<Room[]>(res, [])),
      fetch(`/api/assignments?date=${date}&peek=1`).then((res) => readJson<{ task: { id: string } }[]>(res, [])),
    ]).then(([r, a]) => {
      setRooms(Array.isArray(r) ? r : []);
      setOnDay(new Set((Array.isArray(a) ? a : []).map((x) => x.task.id)));
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

  const typedName = query.trim();
  const exactMatch = typedName.length > 0 && rooms.some((room) =>
    room.tasks.some((t) => t.name.toLowerCase() === typedName.toLowerCase()),
  );
  const canAddOneOff = typedName.length > 0 && !exactMatch;

  function setSearch(value: string) {
    setQuery(value);
    setComposingOneOff(false);
  }

  async function addCatalog(taskId: string) {
    if (onDay.has(taskId) || adding || addingId) return;
    setAddingId(taskId);
    const res = await fetch("/api/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId, date }),
    });
    if (res.ok) {
      setOnDay((prev) => new Set(prev).add(taskId));
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
      onAdded();
    }
    setAddingId(null);
  }

  function toggle(taskId: string) {
    if (onDay.has(taskId) || adding || addingId) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }

  function toggleRoom(room: Room) {
    const ids = room.tasks.map((t) => t.id).filter((id) => !onDay.has(id));
    if (ids.length === 0 || adding || addingId) return;
    setSelected((prev) => {
      const next = new Set(prev);
      const allOn = ids.every((id) => next.has(id));
      for (const id of ids) {
        if (allOn) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  }

  async function addSelected() {
    const taskIds = [...selected].filter((id) => !onDay.has(id));
    if (taskIds.length === 0 || adding || addingId) return;
    setAdding(true);
    const res = await fetch("/api/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskIds, date }),
    });
    setAdding(false);
    if (res.ok) {
      onAdded();
      onClose();
    }
  }

  async function addOneOff() {
    if (!typedName || !oneOffUserId || savingOneOff || !canAddOneOff) return;
    setSavingOneOff(true);
    const res = await fetch("/api/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        oneOff: true,
        name: typedName,
        userId: oneOffUserId,
        difficulty: oneOffDiff,
        date,
      }),
    });
    setSavingOneOff(false);
    if (res.ok) {
      onAdded();
      onClose();
    }
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

        {users.length > 0 && (
          <div className="mb-3">
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
        )}

        <label className="relative block mb-3">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text3)" }} />
          <input
            autoFocus
            value={query}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full"
            style={{ paddingLeft: 36 }}
            placeholder="Search or add"
            aria-label="Search or add"
          />
        </label>

        {canAddOneOff && (
          <div className="mb-4">
            {composingOneOff ? (
              <div className="space-y-3 p-3 rounded-xl" style={{ background: "var(--surface2)" }}>
                <p className="text-sm font-medium">Add "{typedName}" as a one-off</p>
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
                          background: oneOffDiff === d.value ? "var(--accent-dim)" : "var(--bg)",
                          color: oneOffDiff === d.value ? "var(--accent)" : "var(--text2)",
                          border: `2px solid ${oneOffDiff === d.value ? "var(--accent)" : "transparent"}`,
                        }}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={addOneOff}
                  disabled={savingOneOff}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-white"
                  style={{ background: "var(--accent)" }}
                >
                  {savingOneOff ? "Adding…" : "Add one-off"}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setComposingOneOff(true)}
                className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl text-sm text-left"
                style={{ background: "var(--surface2)" }}
              >
                <Plus size={16} className="shrink-0" style={{ color: "var(--accent)" }} />
                <span>Add a one-off</span>
              </button>
            )}
          </div>
        )}

        <div className="space-y-3">
          {filtered.length === 0 && !canAddOneOff && (
            <p className="text-sm py-4 text-center" style={{ color: "var(--text3)" }}>
              {query ? "No matching chores" : "No catalog chores yet"}
            </p>
          )}
          {filtered.map((room) => {
            const pickable = room.tasks.filter((t) => !onDay.has(t.id));
            const allPicked = pickable.length > 0 && pickable.every((t) => selected.has(t.id));
            return (
            <div key={room.id}>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <p className="text-xs font-medium" style={{ color: "var(--text3)" }}>
                  {room.icon} {room.name}
                </p>
                {pickable.length > 1 && (
                  <button
                    type="button"
                    onClick={() => toggleRoom(room)}
                    className="text-xs"
                    style={{ color: "var(--text3)" }}
                  >
                    {allPicked ? "Clear" : "All"}
                  </button>
                )}
              </div>
              <div className="space-y-1">
                {room.tasks.map((task) => {
                  const added = onDay.has(task.id);
                  const busy = adding || addingId !== null;
                  return (
                    <div
                      key={task.id}
                      className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl text-sm"
                      style={{
                        background: "var(--surface2)",
                        color: added ? "var(--text3)" : "var(--text)",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={added || selected.has(task.id)}
                        disabled={added || busy}
                        onChange={() => toggle(task.id)}
                        className="shrink-0"
                        aria-label={`Select ${task.name}`}
                      />
                      <span className="flex-1 min-w-0 truncate">{task.name}</span>
                      {added ? (
                        <Check size={16} className="shrink-0" style={{ color: "var(--green)" }} />
                      ) : (
                        <button
                          type="button"
                          onClick={() => addCatalog(task.id)}
                          disabled={busy}
                          className="shrink-0 p-1 -mr-1 rounded-lg"
                          aria-label={`Add ${task.name} now`}
                        >
                          <Plus size={16} style={{ color: "var(--text3)" }} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            );
          })}
        </div>
        {selected.size > 0 && (
          <div className="sticky bottom-0 pt-3 mt-3 flex gap-2" style={{ background: "var(--surface)" }}>
            <button
              type="button"
              onClick={addSelected}
              disabled={adding}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-white"
              style={{ background: "var(--accent)" }}
            >
              {adding ? "Adding…" : `Add ${selected.size} chore${selected.size === 1 ? "" : "s"}`}
            </button>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="px-4 py-2.5 rounded-xl text-sm"
              style={{ color: "var(--text3)" }}
            >
              Clear
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
