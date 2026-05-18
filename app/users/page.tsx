"use client";
import { useEffect, useState } from "react";
import { Pencil, Trash2, Plus } from "lucide-react";

type User = { id: string; name: string; haNotifyTarget: string; dailyCapacity: number; notifyTime: string; color: string };
type UserStats = { user: User; weekly: number; monthly: number; yearly: number };

const COLORS = ["#a78bfa", "#f472b6", "#fb923c", "#34d399", "#60a5fa", "#f87171", "#facc15", "#2dd4bf"];

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<UserStats[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState({ name: "", haNotifyTarget: "", dailyCapacity: "6", notifyTime: "08:00", color: COLORS[0] });

  async function load() {
    const [u, s] = await Promise.all([
      fetch("/api/users").then((r) => r.json()),
      fetch("/api/stats").then((r) => r.json()),
    ]);
    setUsers(u);
    setStats(s);
  }

  useEffect(() => { load(); }, []);

  function startEdit(user: User) {
    setEditing(user);
    setForm({ name: user.name, haNotifyTarget: user.haNotifyTarget, dailyCapacity: String(user.dailyCapacity), notifyTime: user.notifyTime, color: user.color });
    setShowForm(true);
  }

  function startNew() {
    setEditing(null);
    setForm({ name: "", haNotifyTarget: "", dailyCapacity: "6", notifyTime: "08:00", color: COLORS[users.length % COLORS.length] });
    setShowForm(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const body = { ...form, dailyCapacity: Number(form.dailyCapacity) };
    if (editing) {
      await fetch(`/api/users/${editing.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    } else {
      await fetch("/api/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    }
    setShowForm(false); setEditing(null); load();
  }

  async function remove(id: string) {
    if (!confirm("Remove this person?")) return;
    await fetch(`/api/users/${id}`, { method: "DELETE" });
    load();
  }

  const maxYearly = Math.max(...stats.map((s) => s.yearly), 1);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">People</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text2)" }}>{users.length} household member{users.length !== 1 ? "s" : ""}</p>
        </div>
        <button onClick={startNew} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium text-white" style={{ background: "var(--accent)" }}>
          <Plus size={14} /> Add Person
        </button>
      </div>

      {showForm && (
        <div className="mb-6 p-5 rounded-2xl space-y-4" style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}>
          <h2 className="font-medium">{editing ? "Edit person" : "New person"}</h2>
          <form onSubmit={save} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs mb-1.5" style={{ color: "var(--text3)" }}>Name</label>
                <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Cassandra" autoFocus />
              </div>
              <div>
                <label className="block text-xs mb-1.5" style={{ color: "var(--text3)" }}>Daily capacity (pts)</label>
                <input type="number" min={1} max={20} required value={form.dailyCapacity} onChange={(e) => setForm((f) => ({ ...f, dailyCapacity: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs mb-1.5" style={{ color: "var(--text3)" }}>HA notify target</label>
                <input value={form.haNotifyTarget} onChange={(e) => setForm((f) => ({ ...f, haNotifyTarget: e.target.value }))} placeholder="notify.cassandras_iphone" />
              </div>
              <div>
                <label className="block text-xs mb-1.5" style={{ color: "var(--text3)" }}>Notify time</label>
                <input type="time" value={form.notifyTime} onChange={(e) => setForm((f) => ({ ...f, notifyTime: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="block text-xs mb-2" style={{ color: "var(--text3)" }}>Color</label>
              <div className="flex gap-2 flex-wrap">
                {COLORS.map((c) => (
                  <button key={c} type="button" onClick={() => setForm((f) => ({ ...f, color: c }))} className="w-7 h-7 rounded-full transition-all" style={{ background: c, outline: form.color === c ? `2px solid ${c}` : "2px solid transparent", outlineOffset: "2px", transform: form.color === c ? "scale(1.2)" : "scale(1)" }} />
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button type="submit" className="px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: "var(--accent)" }}>Save</button>
              <button type="button" onClick={() => { setShowForm(false); setEditing(null); }} className="px-4 py-2 rounded-xl text-sm" style={{ color: "var(--text3)" }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-3">
        {users.map((user) => {
          const userStats = stats.find((s) => s.user.id === user.id);
          return (
            <div key={user.id} className="rounded-2xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}>
              {/* Person row */}
              <div className="flex items-center gap-4 px-4 py-4 group">
                <span className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0" style={{ background: user.color + "22", color: user.color }}>
                  {user.name[0].toUpperCase()}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{user.name}</p>
                  <div className="flex gap-4 mt-0.5 flex-wrap">
                    <span className="text-xs" style={{ color: "var(--text3)" }}>{user.dailyCapacity} pts/day</span>
                    <span className="text-xs" style={{ color: "var(--text3)" }}>notify {user.notifyTime}</span>
                    {user.haNotifyTarget && <span className="text-xs font-mono" style={{ color: "var(--text3)" }}>{user.haNotifyTarget}</span>}
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => startEdit(user)} className="p-2 rounded-xl" style={{ color: "var(--text3)" }}><Pencil size={14} /></button>
                  <button onClick={() => remove(user.id)} className="p-2 rounded-xl" style={{ color: "var(--red)" }}><Trash2 size={14} /></button>
                </div>
              </div>

              {/* Stats row */}
              {userStats && (
                <div className="px-4 pb-4" style={{ borderTop: "1px solid var(--border)" }}>
                  <div className="grid grid-cols-3 gap-2 pt-3">
                    {[
                      { label: "This week", value: userStats.weekly },
                      { label: "This month", value: userStats.monthly },
                      { label: "This year", value: userStats.yearly },
                    ].map(({ label, value }) => (
                      <div key={label} className="text-center py-2.5 px-2 rounded-xl" style={{ background: "var(--surface2)" }}>
                        <div className="text-xl font-semibold" style={{ color: user.color }}>{value}</div>
                        <div className="text-xs mt-0.5" style={{ color: "var(--text3)" }}>{label}</div>
                      </div>
                    ))}
                  </div>
                  {userStats.yearly > 0 && (
                    <div className="mt-3">
                      <div className="h-1 rounded-full overflow-hidden" style={{ background: "var(--surface2)" }}>
                        <div className="h-full rounded-full transition-all" style={{ width: `${(userStats.yearly / maxYearly) * 100}%`, background: user.color }} />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {users.length === 0 && (
          <div className="text-center py-20" style={{ color: "var(--text2)" }}>
            <p className="text-4xl mb-3">👤</p>
            <p className="font-medium">No people yet</p>
            <p className="text-sm mt-1" style={{ color: "var(--text3)" }}>Add household members to start assigning tasks</p>
          </div>
        )}
      </div>
    </div>
  );
}
