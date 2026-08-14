"use client";
import { useState } from "react";
import DogIcon from "@/components/DogIcon";

type LoginUser = { id: string; name: string; color: string };

export default function LoginForm({ users }: { users: LoginUser[] }) {
  const [selectedId, setSelectedId] = useState<string>(users[0]?.id ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId) return;
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: selectedId, password }),
    });
    if (res.ok) {
      // Full navigation so the proxy sees the new session cookie.
      window.location.href = "/";
      return;
    }
    const data = await res.json().catch(() => ({}));
    setError(data.error ?? "Login failed");
    setPassword("");
    setLoading(false);
  }

  return (
    <div className="min-h-full flex items-center justify-center px-5 py-16">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5 justify-center mb-8">
          <DogIcon size={36} />
          <span className="font-semibold text-xl tracking-tight" style={{ color: "var(--text)" }}>
            Sweepy
          </span>
        </div>

        {users.length === 0 ? (
          <div
            className="rounded-2xl p-6 text-center text-sm"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text2)" }}
          >
            <p className="font-medium mb-1" style={{ color: "var(--text)" }}>
              No accounts set up yet
            </p>
            <p>
              Set a password for someone on the Pi first:
              <br />
              <code className="text-xs">docker compose exec sweepy node scripts/set-password.js</code>
            </p>
          </div>
        ) : (
          <form
            onSubmit={submit}
            className="rounded-2xl p-6 space-y-5"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}
          >
            <div>
              <label className="block text-xs mb-2" style={{ color: "var(--text3)" }}>
                Who are you?
              </label>
              <div className="flex flex-wrap gap-2">
                {users.map((u) => {
                  const active = u.id === selectedId;
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => setSelectedId(u.id)}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all"
                      style={{
                        background: active ? u.color + "22" : "var(--surface2)",
                        color: active ? u.color : "var(--text2)",
                        outline: active ? `2px solid ${u.color}` : "2px solid transparent",
                      }}
                    >
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: u.color }} />
                      {u.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs mb-1.5" style={{ color: "var(--text3)" }}>
                Password
              </label>
              <input
                type="password"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-sm" style={{ color: "var(--red)" }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !selectedId}
              className="w-full px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-opacity"
              style={{ background: "var(--accent)", opacity: loading ? 0.6 : 1 }}
            >
              {loading ? "Logging in…" : "Log in"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
