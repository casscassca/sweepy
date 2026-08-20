"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Pencil, Trash2, Plus, KeyRound, RefreshCw, Check, Copy, Bell, ScrollText, TreePalm } from "lucide-react";
import { encodeWeek, parseWeek } from "@/lib/capacity";
import { calendarDayStr } from "@/lib/dates";
import { invalidateApi, loadJson } from "@/lib/api-cache";
import { houseVacationActive, vacationActive } from "@/lib/vacation";

type User = {
  id: string;
  name: string;
  haNotifyTarget: string;
  dailyCapacity: number;
  dailyTaskLimit: number;
  weekdayCapacities?: string;
  weekdayTaskLimits?: string;
  weekendShare?: boolean;
  weekendCapacity?: number;
  weekendTaskLimit?: number;
  notifyTime: string;
  nudgeTime?: string;
  color: string;
  webhookSecret: string;
  hasPassword: boolean;
  vacationOn?: boolean;
  vacationStart?: string;
  vacationEnd?: string;
};
type UserStats = { user: User; weekly: number; monthly: number; yearly: number };
type HouseVac = {
  houseVacation: boolean;
  houseVacationStart: string;
  houseVacationEnd: string;
  pauseDirtiness: boolean;
};

const COLORS = ["#a78bfa", "#f472b6", "#fb923c", "#34d399", "#60a5fa", "#f87171", "#facc15", "#2dd4bf"];
const DAY_LETTERS = ["M", "T", "W", "T", "F"];

function CapCell({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <input
      type="number"
      min={0}
      max={20}
      aria-label={label}
      value={value}
      onChange={(e) => onChange(Math.min(20, Math.max(0, Number(e.target.value) || 0)))}
      className="text-center text-sm tabular-nums"
      style={{ width: "100%", padding: "6px 0", fontSize: 14 }}
    />
  );
}

function CapacityGrid({
  tasks,
  pts,
  weekendShare,
  weekendTasks,
  weekendPts,
  onTasks,
  onPts,
  onWeekendShare,
  onWeekendTasks,
  onWeekendPts,
}: {
  tasks: number[];
  pts: number[];
  weekendShare: boolean;
  weekendTasks: number;
  weekendPts: number;
  onTasks: (next: number[]) => void;
  onPts: (next: number[]) => void;
  onWeekendShare: (on: boolean) => void;
  onWeekendTasks: (n: number) => void;
  onWeekendPts: (n: number) => void;
}) {
  const days = weekendShare ? [...DAY_LETTERS, "S+S"] : [...DAY_LETTERS, "S", "S"];
  const taskVals = weekendShare ? [...tasks.slice(0, 5), weekendTasks] : tasks.slice(0, 7);
  const ptVals = weekendShare ? [...pts.slice(0, 5), weekendPts] : pts.slice(0, 7);
  const labels = weekendShare ? [...DAY_LETTERS, "Weekend"] : [...DAY_LETTERS, "Sat", "Sun"];
  function setDay(kind: "tasks" | "pts", i: number, v: number) {
    if (weekendShare && i === 5) {
      if (kind === "tasks") onWeekendTasks(v);
      else onWeekendPts(v);
      return;
    }
    if (kind === "tasks") {
      const next = [...tasks.slice(0, 7)];
      while (next.length < 7) next.push(next[next.length - 1] ?? 0);
      next[i] = v;
      onTasks(next);
    } else {
      const next = [...pts.slice(0, 7)];
      while (next.length < 7) next.push(next[next.length - 1] ?? 0);
      next[i] = v;
      onPts(next);
    }
  }
  return (
    <>
    <div
      className="grid gap-x-1 gap-y-1 items-center"
      style={{ gridTemplateColumns: `2.5rem repeat(${days.length}, minmax(0, 1fr))` }}
    >
      <span />
      {days.map((letter, i) => (
        <span key={`h-${letter}-${i}`} className="text-center text-[11px]" style={{ color: "var(--text3)" }}>{letter}</span>
      ))}
      <span className="text-[11px]" style={{ color: "var(--text3)" }}>tasks</span>
      {taskVals.map((n, i) => (
        <CapCell
          key={`t-${i}`}
          label={`${labels[i]} tasks`}
          value={n}
          onChange={(v) => setDay("tasks", i, v)}
        />
      ))}
      <span className="text-[11px]" style={{ color: "var(--text3)" }}>pts</span>
      {ptVals.map((n, i) => (
        <CapCell
          key={`p-${i}`}
          label={`${labels[i]} points`}
          value={n}
          onChange={(v) => setDay("pts", i, v)}
        />
      ))}
    </div>
    <label className="flex items-center gap-2 mt-2.5 text-sm">
      <input type="checkbox" checked={weekendShare} onChange={(e) => onWeekendShare(e.target.checked)} />
      Combine Sat and Sun
    </label>
  </>
  );
}

function VacationDates({
  start,
  end,
  onStart,
  onEnd,
}: {
  start: string;
  end: string;
  onStart: (v: string) => void;
  onEnd: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="block text-xs mb-1.5" style={{ color: "var(--text3)" }}>From</label>
        <input type="date" value={start} onChange={(e) => onStart(e.target.value)} />
      </div>
      <div>
        <label className="block text-xs mb-1.5" style={{ color: "var(--text3)" }}>Until</label>
        <input type="date" value={end} onChange={(e) => onEnd(e.target.value)} />
      </div>
    </div>
  );
}

function emptyForm(color: string) {
  return {
    name: "",
    haNotifyTarget: "",
    dailyCapacity: "6",
    dailyTaskLimit: "6",
    weekdayCapacities: encodeWeek([6, 6, 6, 6, 6, 6, 6]),
    weekdayTaskLimits: encodeWeek([6, 6, 6, 6, 6, 6, 6]),
    weekendShare: true,
    weekendCapacity: "6",
    weekendTaskLimit: "4",
    notifyTime: "08:00",
    nudgeTime: "",
    color,
    password: "",
    vacationOn: false,
    vacationStart: "",
    vacationEnd: "",
  };
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<UserStats[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState(emptyForm(COLORS[0]));
  const [house, setHouse] = useState<HouseVac>({
    houseVacation: false,
    houseVacationStart: "",
    houseVacationEnd: "",
    pauseDirtiness: false,
  });
  const [showToken, setShowToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [notifyMsg, setNotifyMsg] = useState<string | null>(null);
  const [notifyDetail, setNotifyDetail] = useState<string[] | null>(null);

  async function load() {
    await Promise.all([
      loadJson<User[]>("/api/users", [], (u) => setUsers(Array.isArray(u) ? u : [])),
      loadJson<UserStats[]>("/api/stats", [], (s) => setStats(Array.isArray(s) ? s : [])),
      loadJson<HouseVac & { houseVacation?: boolean } | null>("/api/settings", null, (settings) => {
        if (!settings) return;
        setHouse({
          houseVacation: settings.houseVacation === true,
          houseVacationStart: settings.houseVacationStart ?? "",
          houseVacationEnd: settings.houseVacationEnd ?? "",
          pauseDirtiness: settings.pauseDirtiness === true,
        });
      }),
    ]);
  }

  useEffect(() => { load(); }, []);

  function startEdit(user: User) {
    setEditing(user);
    setForm({
      name: user.name,
      haNotifyTarget: user.haNotifyTarget,
      dailyCapacity: String(user.dailyCapacity),
      dailyTaskLimit: String(user.dailyTaskLimit ?? 6),
      weekdayCapacities: encodeWeek(parseWeek(user.weekdayCapacities, user.dailyCapacity)),
      weekdayTaskLimits: encodeWeek(parseWeek(user.weekdayTaskLimits, user.dailyTaskLimit ?? 6)),
      weekendShare: user.weekendShare !== false,
      weekendCapacity: String(user.weekendCapacity ?? 6),
      weekendTaskLimit: String(user.weekendTaskLimit ?? 4),
      notifyTime: user.notifyTime,
      nudgeTime: user.nudgeTime ?? "",
      color: user.color,
      password: "",
      vacationOn: user.vacationOn === true,
      vacationStart: user.vacationStart ?? "",
      vacationEnd: user.vacationEnd ?? "",
    });
    setShowToken(null);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditing(null);
  }

  function startNew() {
    setEditing(null);
    setForm(emptyForm(COLORS[users.length % COLORS.length]));
    setShowForm(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    // Only send a password when one was typed (blank = leave unchanged).
    const { password, ...rest } = form;
    const body: Record<string, unknown> = {
      ...rest,
      dailyCapacity: Number(form.dailyCapacity),
      dailyTaskLimit: Number(form.dailyTaskLimit),
      weekdayCapacities: form.weekdayCapacities,
      weekdayTaskLimits: form.weekdayTaskLimits,
      weekendShare: form.weekendShare !== false,
      weekendCapacity: Number(form.weekendCapacity),
      weekendTaskLimit: Number(form.weekendTaskLimit),
      vacationOn: form.vacationOn === true,
      vacationStart: form.vacationStart,
      vacationEnd: form.vacationEnd,
    };
    if (password.trim()) body.password = password;
    if (editing) {
      await fetch(`/api/users/${editing.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    } else {
      await fetch("/api/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    }
    closeForm();
    invalidateApi("/api/users", "/api/auth/me");
    load();
  }

  async function regenerateToken(id: string) {
    if (!confirm("Generate a new webhook token? The old one stops working — you'll need to update this person's Home Assistant automation.")) return;
    await fetch(`/api/users/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ regenerateWebhookSecret: true }) });
    invalidateApi("/api/users");
    load();
  }

  async function notifyNow(user: User) {
    const res = await fetch("/api/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, replace: true }),
    });
    const data = await res.json().catch(() => ({}));
    if (data.ok && data.sent === 0) setNotifyMsg(data.reason ?? `Cleared ${user.name}'s notifies`);
    else if (data.ok) setNotifyMsg(`Resent ${data.sent} to ${user.name}`);
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
    invalidateApi("/api/users", "/api/auth/me");
    load();
  }

  async function saveHouse(next: HouseVac) {
    setHouse(next);
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
    invalidateApi("/api/settings", "/api/load");
  }

  const today = calendarDayStr();
  const houseAway = houseVacationActive(house, today);

  const maxYearly = Math.max(...stats.map((s) => s.yearly), 1);

  const formFields = (
    <form onSubmit={save} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="block text-xs mb-1.5" style={{ color: "var(--text3)" }}>Name</label>
          <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Cassandra" autoFocus />
        </div>
        <div className="sm:col-span-2">
          <p className="text-xs mb-2" style={{ color: "var(--text3)" }}>Capacity · tasks then points</p>
          <CapacityGrid
            tasks={parseWeek(form.weekdayTaskLimits, Number(form.dailyTaskLimit) || 0)}
            pts={parseWeek(form.weekdayCapacities, Number(form.dailyCapacity) || 0)}
            weekendShare={form.weekendShare !== false}
            weekendTasks={Number(form.weekendTaskLimit) || 0}
            weekendPts={Number(form.weekendCapacity) || 0}
            onTasks={(next) => setForm((f) => ({
              ...f,
              weekdayTaskLimits: encodeWeek(next),
              dailyTaskLimit: String(next[0] ?? 0),
            }))}
            onPts={(next) => setForm((f) => ({
              ...f,
              weekdayCapacities: encodeWeek(next),
              dailyCapacity: String(next[0] ?? 0),
            }))}
            onWeekendShare={(on) => setForm((f) => ({ ...f, weekendShare: on }))}
            onWeekendTasks={(n) => setForm((f) => ({ ...f, weekendTaskLimit: String(n) }))}
            onWeekendPts={(n) => setForm((f) => ({ ...f, weekendCapacity: String(n) }))}
          />
          <p className="text-xs mt-2" style={{ color: "var(--text3)" }}>
            {form.weekendShare !== false
              ? "S+S is this person's Sat and Sun pot, not each day. Pins and drags can go over."
              : "Sat and Sun are their own days. Pins and drags can go over."}
          </p>
        </div>
        <div>
          <label className="block text-xs mb-1.5" style={{ color: "var(--text3)" }}>HA notify target</label>
          <input value={form.haNotifyTarget} onChange={(e) => setForm((f) => ({ ...f, haNotifyTarget: e.target.value }))} placeholder="notify.pixel or notify.mobile_app_pixel" />
        </div>
        <div>
          <label className="block text-xs mb-1.5" style={{ color: "var(--text3)" }}>Notify time</label>
          <input type="time" value={form.notifyTime} onChange={(e) => setForm((f) => ({ ...f, notifyTime: e.target.value }))} />
        </div>
        <div>
          <label className="block text-xs mb-1.5" style={{ color: "var(--text3)" }}>
            Resend if still open
            {form.nudgeTime && (
              <button
                type="button"
                className="ml-2"
                onClick={() => setForm((f) => ({ ...f, nudgeTime: "" }))}
              >
                Off
              </button>
            )}
          </label>
          <input type="time" value={form.nudgeTime} onChange={(e) => setForm((f) => ({ ...f, nudgeTime: e.target.value }))} />
          <p className="text-xs mt-1.5" style={{ color: "var(--text3)" }}>Clears this morning's banners and sends what's left. Leave blank to skip.</p>
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
      <div className="sm:col-span-2 pt-1" style={{ borderTop: "1px solid var(--border)" }}>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.vacationOn === true}
            onChange={(e) => setForm((f) => ({ ...f, vacationOn: e.target.checked }))}
          />
          Vacation
        </label>
        {form.vacationOn === true && (
          <div className="mt-3 space-y-2">
            <VacationDates
              start={form.vacationStart}
              end={form.vacationEnd}
              onStart={(v) => setForm((f) => ({ ...f, vacationStart: v }))}
              onEnd={(v) => setForm((f) => ({ ...f, vacationEnd: v }))}
            />
            <p className="text-xs" style={{ color: "var(--text3)" }}>
              Optional dates. Leave them blank to stay off until you uncheck. No notifies. Pins and one-offs wait off today. Dirt keeps accumulating.
            </p>
          </div>
        )}
      </div>
      <div className="flex gap-2 pt-1">
        <button type="submit" className="px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: "var(--accent)" }}>Save</button>
        <button type="button" onClick={closeForm} className="px-4 py-2 rounded-xl text-sm" style={{ color: "var(--text3)" }}>Cancel</button>
      </div>
    </form>
  );

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

      <div className="space-y-3">
        {showForm && !editing && (
          <div className="p-5 rounded-2xl space-y-4" style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}>
            <h2 className="font-medium">New person</h2>
            {formFields}
          </div>
        )}

        {users.map((user) => {
          const userStats = stats.find((s) => s.user.id === user.id);
          return (
            <div key={user.id} className="rounded-2xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}>
              {editing?.id === user.id ? (
                <div className="p-5 space-y-4">
                  <h2 className="font-medium">Edit {user.name}</h2>
                  {formFields}
                </div>
              ) : (
              <>
              <div className="flex items-center gap-3 sm:gap-4 px-4 py-4 group">
                <span className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0" style={{ background: user.color + "22", color: user.color }}>
                  {user.name[0].toUpperCase()}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium flex items-center gap-2">
                    {user.name}
                    {(houseAway || vacationActive(user, today)) && (
                      <span className="text-xs font-normal px-1.5 py-px rounded-full" style={{ background: "var(--accent)22", color: "var(--accent)" }}>away</span>
                    )}
                    {!user.hasPassword && (
                      <span className="text-xs font-normal px-1.5 py-px rounded-full" style={{ background: "var(--red)22", color: "var(--red)" }}>no password</span>
                    )}
                  </p>
                  <div className="flex gap-4 mt-0.5 flex-wrap">
                    <span className="text-xs" style={{ color: "var(--text3)" }}>
                      {(() => {
                        const weekTasks = parseWeek(user.weekdayTaskLimits, user.dailyTaskLimit);
                        const weekPts = parseWeek(user.weekdayCapacities, user.dailyCapacity);
                        const tasks = weekTasks.slice(0, 5);
                        const pts = weekPts.slice(0, 5);
                        const flat = tasks.every((n) => n === tasks[0]) && pts.every((n) => n === pts[0]);
                        const weekdays = flat
                          ? `${tasks[0]} task${tasks[0] === 1 ? "" : "s"} · ${pts[0]} pts weekdays`
                          : `M–F ${tasks.join(" ")} tasks`;
                        if (user.weekendShare === false) {
                          const same = weekTasks[5] === weekTasks[6] && weekPts[5] === weekPts[6];
                          if (same) return `${weekdays} · S S ${weekTasks[5]} / ${weekPts[5]} pts`;
                          return `${weekdays} · Sat ${weekTasks[5]} / ${weekPts[5]} · Sun ${weekTasks[6]} / ${weekPts[6]}`;
                        }
                        return `${weekdays} · S+S ${user.weekendTaskLimit ?? 4} / ${user.weekendCapacity ?? 6} pts`;
                      })()}
                    </span>
                    <span className="text-xs" style={{ color: "var(--text3)" }}>
                      notify {user.notifyTime}{user.nudgeTime ? ` · again ${user.nudgeTime}` : ""}
                    </span>
                    {user.haNotifyTarget && <span className="text-xs font-mono" style={{ color: "var(--text3)" }}>{user.haNotifyTarget}</span>}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => notifyNow(user)} title="Clear this person's phone notifies and resend today's list" aria-label="Resend notifies" className="p-2 rounded-xl opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity" style={{ color: "var(--text3)" }}><Bell size={14} /></button>
                  <button onClick={() => setShowToken(showToken === user.id ? null : user.id)} title="Webhook token" aria-label="Webhook token" className={`p-2 rounded-xl transition-opacity ${showToken === user.id ? "opacity-100" : "opacity-100 md:opacity-0 md:group-hover:opacity-100"}`} style={{ color: showToken === user.id ? "var(--accent)" : "var(--text3)" }}><KeyRound size={14} /></button>
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
                      { label: "pts this week", value: userStats.weekly },
                      { label: "pts this month", value: userStats.monthly },
                      { label: "pts this year", value: userStats.yearly },
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
              </>
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

      <div className="mt-6 space-y-3">
        <div className="px-4 py-3.5 rounded-2xl" style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}>
          <div className="flex items-center gap-3">
            <span
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background: house.houseVacation ? "var(--green-dim)" : "var(--accent-dim)",
                color: house.houseVacation ? "var(--green)" : "var(--accent)",
              }}
            >
              <TreePalm size={16} />
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">House vacation</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text3)" }}>
                {!house.houseVacation
                  ? "No auto-assign or morning notifies while everyone is away"
                  : houseAway
                    ? house.pauseDirtiness
                      ? "Everyone is away. Chores stay as dirty as they are now."
                      : "Everyone is away. Chores keep getting dirtier."
                    : "Optional dates. Leave them blank to stay off until you uncheck."}
              </p>
            </div>
            <input
              type="checkbox"
              className="shrink-0"
              checked={house.houseVacation}
              onChange={(e) => saveHouse({
                ...house,
                houseVacation: e.target.checked,
                pauseDirtiness: e.target.checked ? house.pauseDirtiness : false,
              })}
              aria-label="House vacation"
            />
          </div>
          {house.houseVacation && (
            <div className="mt-4 pt-4 space-y-3" style={{ borderTop: "1px solid var(--border)" }}>
              <VacationDates
                start={house.houseVacationStart}
                end={house.houseVacationEnd}
                onStart={(v) => saveHouse({ ...house, houseVacationStart: v })}
                onEnd={(v) => saveHouse({ ...house, houseVacationEnd: v })}
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={house.pauseDirtiness}
                  onChange={(e) => saveHouse({ ...house, pauseDirtiness: e.target.checked })}
                />
                Pause dirtiness
              </label>
            </div>
          )}
        </div>

        <Link
          href="/history"
          className="flex items-center gap-3 px-4 py-3.5 rounded-2xl"
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
    </div>
  );
}
