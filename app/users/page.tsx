"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Pencil, Trash2, Plus, KeyRound, RefreshCw, Check, Copy, Bell, ScrollText } from "lucide-react";

type User = { id: string; name: string; haNotifyTarget: string; dailyCapacity: number; dailyTaskLimit: number; notifyTime: string; color: string; webhookSecret: string; hasPassword: boolean };
type UserStats = { user: User; weekly: number; monthly: number; yearly: number };

const COLORS = ["#a78bfa", "#f472b6", "#fb923c", "#34d399", "#60a5fa", "#f87171", "#facc15", "#2dd4bf"];

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<UserStats[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState({ name: "", haNotifyTarget: "", dailyCapacity: "6", dailyTaskLimit: "6", notifyTime: "08:00", color: COLORS[0], password: "" });
  const [showToken, setShowToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [notifyMsg, setNotifyMsg] = useState<string | null>(null);
  const [notifyDetail, setNotifyDetail] = useState<string[] | null>(null);

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
    setForm({ name: user.name, haNotifyTarget: user.haNotifyTarget, dailyCapacity: String(user.dailyCapacity), dailyTaskLimit: String(user.dailyTaskLimit ?? 6), notifyTime: user.notifyTime, color: user.color, password: "" });
    setShowForm(true);
  }

  function startNew() {
    setEditing(null);
    setForm({ name: "", haNotifyTarget: "", dailyCapacity: "6", dailyTaskLimit: "6", notifyTime: "08:00", color: COLORS[users.length % COLORS.length], password: "" });
    setShowForm(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    // Only send a password when one was typed (blank = leave unchanged).
    const { password, ...rest } = form;
    const body: Record<string, unknown> = { ...rest, dailyCapacity: Number(form.dailyCapacity), dailyTaskLimit: Number(form.dailyTaskLimit) };
    if (password.trim()) body.password = password;
    if (editing) {
      await fetch(`/api/users/${editing.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    } else {
      await fetch("/api/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    }
    setShowForm(false); setEditing(null); load();
  }

  async function regenerateToken(id: string) {
    if (!confirm("Generate a new webhook token? The old one stops working — you'll need to update this person's Home Assistant automation.")) return;
    await fetch(`/api/users/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ regenerateWebhookSecret: true }) });
    load();
  }

  async function notifyNow(user: User) {
    const res = await fetch("/api/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id }),
    });
    const data = await res.json().catch(() => ({}));
    if (data.ok) setNotifyMsg(`Sent ${data.sent} notify${data.sent === 1 ? "" : "s"} to ${user.name}`);
    else setNotifyMsg(data.reason ?? "Notify failed");
    const attempts = Array.isArray(data.attempts)
      ? data.attempts.map((a: { taskName: string; service: string; status: number; ok: boolean; url: string }) =>
          `${a.ok ? "ok" : a.status}  ${a.taskName}  ${a.service}${a.url ? `\n    ${a.url}` : ""}`,
        )
      : null;
    setNotifyDetail(attempts);
    if (data.ok) setTimeout(() => { setNotifyMsg(null); setNotifyDetail(null); }, 8000);
  }

  function copyToken(token: string) {
    navigator.clipboard?.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function remove(id: string) {
    if (!confirm("Remove this person?")) return;
    await fetch(`/api/users/${id}`, { method: "DELETE" });
    load();
  }

  const maxYearly = Math.max(...stats.map((s) => s.yearly), 1);

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">People</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text2)" }}>{users.length} household member{users.length !== 1 ? "s" : ""}</p>
        </div>
        {notifyMsg && (
          <p className="text-sm shrink-0 max-w-[14rem] truncate" style={{ color: "var(--text2)" }}>{notifyMsg}</p>
        )}
        <button onClick={startNew} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium text-white shrink-0" style={{ background: "var(--accent)" }}>
          <Plus size={14} /> Add Person
        </button>
      </div>

      {notifyMsg && (
        <div className="mb-6 p-4 rounded-2xl space-y-2" style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}>
          <p className="text-sm font-medium">{notifyMsg}</p>
          {notifyDetail && notifyDetail.length > 0 && (
            <pre className="text-xs font-mono whitespace-pre-wrap break-all" style={{ color: "var(--text2)" }}>
              {notifyDetail.join("\n")}
            </pre>
          )}
        </div>
      )}

      {showForm && (
        <div className="mb-6 p-5 rounded-2xl space-y-4" style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}>
          <h2 className="font-medium">{editing ? "Edit person" : "New person"}</h2>
          <form onSubmit={save} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs mb-1.5" style={{ color: "var(--text3)" }}>Name</label>
                <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Cassandra" autoFocus />
              </div>
              <div>
                <label className="block text-xs mb-1.5" style={{ color: "var(--text3)" }}>Daily points</label>
                <input type="number" min={1} max={20} required value={form.dailyCapacity} onChange={(e) => setForm((f) => ({ ...f, dailyCapacity: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs mb-1.5" style={{ color: "var(--text3)" }}>Daily tasks</label>
                <input type="number" min={1} max={20} required value={form.dailyTaskLimit} onChange={(e) => setForm((f) => ({ ...f, dailyTaskLimit: e.target.value }))} />
              </div>
              <p className="text-xs sm:col-span-2 -mt-2" style={{ color: "var(--text3)" }}>
                Auto-assign stops at these. Pins, one-offs, and anything you drag on can go over.
              </p>
              <div>
                <label className="block text-xs mb-1.5" style={{ color: "var(--text3)" }}>HA notify target</label>
                <input value={form.haNotifyTarget} onChange={(e) => setForm((f) => ({ ...f, haNotifyTarget: e.target.value }))} placeholder="notify.pixel or notify.mobile_app_pixel" />
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
            <div>
              <label className="block text-xs mb-1.5" style={{ color: "var(--text3)" }}>
                {editing ? "Login password" : "Login password (optional)"}
              </label>
              <input type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder={editing && editing.hasPassword ? "•••••••• (leave blank to keep)" : "Set a password"} autoComplete="new-password" />
              <p className="text-xs mt-1.5" style={{ color: "var(--text3)" }}>This person uses it to log in. Leave blank to keep the current one.</p>
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
              <div className="flex items-center gap-3 sm:gap-4 px-4 py-4 group">
                <span className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0" style={{ background: user.color + "22", color: user.color }}>
                  {user.name[0].toUpperCase()}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium flex items-center gap-2">
                    {user.name}
                    {!user.hasPassword && (
                      <span className="text-xs font-normal px-1.5 py-px rounded-full" style={{ background: "var(--red)22", color: "var(--red)" }}>no password</span>
                    )}
                  </p>
                  <div className="flex gap-4 mt-0.5 flex-wrap">
                    <span className="text-xs" style={{ color: "var(--text3)" }}>{user.dailyTaskLimit} task{user.dailyTaskLimit === 1 ? "" : "s"} · {user.dailyCapacity} pts/day</span>
                    <span className="text-xs" style={{ color: "var(--text3)" }}>notify {user.notifyTime}</span>
                    {user.haNotifyTarget && <span className="text-xs font-mono" style={{ color: "var(--text3)" }}>{user.haNotifyTarget}</span>}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => notifyNow(user)} title="Send today's notifies now" aria-label="Send notify now" className="p-2 rounded-xl" style={{ color: "var(--text3)" }}><Bell size={14} /></button>
                  <button onClick={() => setShowToken(showToken === user.id ? null : user.id)} title="Webhook token" aria-label="Webhook token" className="p-2 rounded-xl" style={{ color: showToken === user.id ? "var(--accent)" : "var(--text3)" }}><KeyRound size={14} /></button>
                  <button onClick={() => startEdit(user)} className="p-2 rounded-xl opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity" style={{ color: "var(--text3)" }} aria-label="Edit person"><Pencil size={14} /></button>
                  <button onClick={() => remove(user.id)} className="p-2 rounded-xl opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity" style={{ color: "var(--red)" }} aria-label="Remove person"><Trash2 size={14} /></button>
                </div>
              </div>

              {/* Webhook token panel */}
              {showToken === user.id && (
                <div className="px-4 pb-4" style={{ borderTop: "1px solid var(--border)" }}>
                  <p className="text-xs mt-3 mb-1.5" style={{ color: "var(--text3)" }}>
                    Optional backup webhook token for {user.name}. Button taps are handled live from Home Assistant; this is only needed if that listener is down.
                  </p>
                  <div className="flex items-center gap-2 min-w-0">
                    <code className="flex-1 min-w-0 text-xs font-mono px-3 py-2 rounded-lg overflow-x-auto whitespace-nowrap" style={{ background: "var(--surface2)", color: "var(--text2)" }}>
                      {user.webhookSecret || "(none — generate one)"}
                    </code>
                    {user.webhookSecret && (
                      <button onClick={() => copyToken(user.webhookSecret)} title="Copy" className="p-2 rounded-lg shrink-0" style={{ color: "var(--text3)" }}>
                        {copied ? <Check size={14} /> : <Copy size={14} />}
                      </button>
                    )}
                    <button onClick={() => regenerateToken(user.id)} title="Generate new token" className="p-2 rounded-lg shrink-0" style={{ color: "var(--text3)" }}>
                      <RefreshCw size={14} />
                    </button>
                  </div>
                  <p className="text-xs mt-2 font-mono" style={{ color: "var(--text3)" }}>
                    Send it as header <span style={{ color: "var(--text2)" }}>x-webhook-secret</span> to /api/ha-webhook
                  </p>
                </div>
              )}

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

      <Link
        href="/history"
        className="mt-6 flex items-center gap-3 px-4 py-3.5 rounded-2xl"
        style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}
      >
        <span
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "var(--accent-dim)", color: "var(--accent)" }}
        >
          <ScrollText size={16} />
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm">Completion history</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text3)" }}>A timeline of everything that’s been checked off</p>
        </div>
      </Link>
    </div>
  );
}
