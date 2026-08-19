"use client";
import { useEffect, useState } from "react";
import { readJson } from "@/lib/read-json";

type UserStats = {
  user: { id: string; name: string; color: string };
  weekly: number;
  monthly: number;
  yearly: number;
};

export default function StatsPage() {
  const [stats, setStats] = useState<UserStats[]>([]);

  useEffect(() => {
    fetch("/api/stats").then((res) => readJson<UserStats[]>(res, [])).then((data) => setStats(Array.isArray(data) ? data : []));
  }, []);

  const maxYearly = Math.max(...stats.map((s) => s.yearly), 1);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Stats</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text2)" }}>Points per person over time · quick 1 · medium 2 · big job 3</p>
      </div>

      {stats.length === 0 ? (
        <div className="text-center py-20" style={{ color: "var(--text2)" }}>
          <p className="text-4xl mb-3">📊</p>
          <p className="font-medium">No completions yet</p>
          <p className="text-sm mt-1" style={{ color: "var(--text3)" }}>Start checking off tasks to see stats here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {stats.map((s) => (
            <div
              key={s.user.id}
              className="p-5 rounded-2xl"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <div className="flex items-center gap-3 mb-5">
                <span
                  className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0"
                  style={{ background: s.user.color + "22", color: s.user.color }}
                >
                  {s.user.name[0].toUpperCase()}
                </span>
                <span className="font-medium">{s.user.name}</span>
                <span
                  className="text-xs px-2 py-0.5 rounded-full ml-auto"
                  style={{ background: s.user.color + "22", color: s.user.color }}
                >
                  {s.yearly} pts this year
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-5">
                {[
                  { label: "pts this week", value: s.weekly },
                  { label: "pts this month", value: s.monthly },
                  { label: "pts this year", value: s.yearly },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    className="text-center p-4 rounded-xl"
                    style={{ background: "var(--surface2)" }}
                  >
                    <div className="text-3xl font-semibold" style={{ color: s.user.color }}>
                      {value}
                    </div>
                    <div className="text-xs mt-1" style={{ color: "var(--text3)" }}>{label}</div>
                  </div>
                ))}
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1.5" style={{ color: "var(--text3)" }}>
                  <span>Yearly progress</span>
                  <span>{Math.round((s.yearly / maxYearly) * 100)}%</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--surface2)" }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${(s.yearly / maxYearly) * 100}%`, background: s.user.color }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
