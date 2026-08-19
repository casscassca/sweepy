"use client";
import { useEffect, useMemo, useState } from "react";
import { format, isToday, isYesterday, parseISO } from "date-fns";
import Link from "next/link";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { readJson } from "@/lib/read-json";

type Person = { id: string; name: string; color: string };
type Entry = {
  id: string;
  completedAt: string;
  task: { name: string; oneOff: boolean; difficulty: number; room: { name: string } | null };
  user: Person;
  completedBy: Person | null;
};

const DIFF_COLOR = ["", "#a78bfa", "#fb923c", "#f87171"];
const DIFF_LABEL = ["", "quick", "medium", "big job"];

function dayHeading(dateStr: string) {
  const d = parseISO(`${dateStr}T12:00:00`);
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "EEEE, MMM d");
}

function FilterChip({
  label, color, active, onClick,
}: {
  label: string; color?: string; active: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium shrink-0 transition-all"
      style={{
        background: active ? (color ? color + "22" : "var(--accent-dim)") : "var(--surface)",
        color: active ? (color ?? "var(--accent)") : "var(--text2)",
        border: `2px solid ${active ? (color ?? "var(--accent)") : "var(--border)"}`,
        boxShadow: active ? "none" : "var(--shadow)",
      }}
    >
      {color && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />}
      {label}
    </button>
  );
}

export default function HistoryPage() {
  const [users, setUsers] = useState<Person[]>([]);
  const [who, setWho] = useState<string>("all");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [undoingId, setUndoingId] = useState<string | null>(null);

  async function load(reset: boolean, before?: string | null) {
    if (reset) setLoading(true);
    else setLoadingMore(true);
    const params = new URLSearchParams();
    if (who !== "all") params.set("userId", who);
    if (before) params.set("before", before);
    const [hist, people] = await Promise.all([
      fetch(`/api/history?${params}`).then((res) => readJson<{ entries?: Entry[]; nextBefore?: string }>(res, { entries: [] })),
      reset ? fetch("/api/users").then((res) => readJson<Person[]>(res, [])) : Promise.resolve(null),
    ]);
    const page = Array.isArray(hist.entries) ? hist.entries : [];
    setEntries((prev) => (reset ? page : [...prev, ...page]));
    setNextBefore(typeof hist.nextBefore === "string" ? hist.nextBefore : null);
    if (Array.isArray(people)) setUsers(people);
    setLoading(false);
    setLoadingMore(false);
  }

  useEffect(() => { load(true); }, [who]);

  async function undo(id: string) {
    if (undoingId) return;
    setUndoingId(id);
    const res = await fetch("/api/history", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setUndoingId(null);
    if (res.ok) setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  const groups = useMemo(() => {
    const byDay = new Map<string, Entry[]>();
    for (const entry of entries) {
      const day = format(new Date(entry.completedAt), "yyyy-MM-dd");
      const list = byDay.get(day) ?? [];
      list.push(entry);
      byDay.set(day, list);
    }
    return Array.from(byDay.entries());
  }, [entries]);

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/users"
          className="inline-flex items-center gap-1.5 text-sm mb-3"
          style={{ color: "var(--text3)" }}
        >
          <ArrowLeft size={14} /> People
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">History</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text2)" }}>
          Everything that’s been checked off
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto mb-5 py-1 -mx-1 px-1">
        <FilterChip label="All" active={who === "all"} onClick={() => setWho("all")} />
        {users.map((u) => (
          <FilterChip
            key={u.id}
            label={u.name}
            color={u.color}
            active={who === u.id}
            onClick={() => setWho(u.id)}
          />
        ))}
      </div>

      {loading ? (
        <div className="text-center py-20" style={{ color: "var(--text3)" }}>Loading history…</div>
      ) : entries.length === 0 ? (
        <div className="text-center py-20" style={{ color: "var(--text2)" }}>
          <p className="text-4xl mb-3">✨</p>
          <p className="font-medium">Nothing checked off yet</p>
          <p className="text-sm mt-1" style={{ color: "var(--text3)" }}>Completions will show up here, including one-offs</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(([day, items]) => (
            <section key={day}>
              <h2 className="font-semibold text-sm mb-2" style={{ color: "var(--text)" }}>
                {dayHeading(day)}
                <span className="font-normal ml-2" style={{ color: "var(--text3)" }}>
                  {items.length} · {items.reduce((s, e) => s + e.task.difficulty, 0)} pts
                </span>
              </h2>
              <ol className="space-y-1.5">
                {items.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl group"
                    style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}
                  >
                    <span className="text-xs tabular-nums w-16 shrink-0" style={{ color: "var(--text3)" }}>
                      {format(new Date(entry.completedAt), "h:mm a")}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{entry.task.name}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text3)" }}>
                          {entry.completedBy ? (
                            <>
                              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: entry.completedBy.color }} />
                              {entry.completedBy.name}
                            </>
                          ) : (
                            <>
                              <span className="flex items-center shrink-0">
                                {users.slice(0, 2).map((u, i) => (
                                  <span
                                    key={u.id}
                                    className="w-1.5 h-1.5 rounded-full"
                                    style={{ background: u.color, marginLeft: i === 0 ? 0 : -2 }}
                                  />
                                ))}
                              </span>
                              Both
                            </>
                          )}
                        </span>
                        <span className="text-xs" style={{ color: "var(--text3)" }}>
                          {entry.task.oneOff ? "one-off" : entry.task.room?.name}
                        </span>
                        <span
                          className="text-xs font-medium px-1.5 py-px rounded-full"
                          style={{
                            background: DIFF_COLOR[entry.task.difficulty] + "22",
                            color: DIFF_COLOR[entry.task.difficulty],
                          }}
                        >
                          {DIFF_LABEL[entry.task.difficulty]}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => undo(entry.id)}
                      disabled={undoingId === entry.id}
                      className="p-2 rounded-lg shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                      style={{ color: "var(--text3)" }}
                      title="Undo this completion"
                      aria-label={`Undo ${entry.task.name}`}
                    >
                      <RotateCcw size={16} />
                    </button>
                  </li>
                ))}
              </ol>
            </section>
          ))}

          {nextBefore && (
            <button
              type="button"
              onClick={() => load(false, nextBefore)}
              disabled={loadingMore}
              className="w-full py-3 rounded-xl text-sm font-medium"
              style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text2)" }}
            >
              {loadingMore ? "Loading…" : "Load earlier"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
