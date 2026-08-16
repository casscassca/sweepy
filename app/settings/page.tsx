"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Moon, ScrollText, Sun } from "lucide-react";
import { format } from "date-fns";

type HaPerson = { name: string; target: string; resolved: string | null; ok: boolean; hint: string | null };
type HaLog = { id: string; createdAt: string; kind: string; ok: boolean; userName: string; summary: string; detail: string };
type HaStatus = {
  configured: boolean;
  url: string | null;
  reachable: boolean;
  listening?: boolean;
  lastEventAt?: string | null;
  error: string | null;
  services: string[];
  entities: string[];
  people: HaPerson[];
  log: HaLog[];
};

export default function SettingsPage() {
  const [webhookUrl, setWebhookUrl] = useState("");
  const [darkMode, setDarkMode] = useState(false);
  const [ha, setHa] = useState<HaStatus | null>(null);
  const [openLogId, setOpenLogId] = useState<string | null>(null);

  useEffect(() => {
    setWebhookUrl(`${window.location.origin}/api/ha-webhook`);
    setDarkMode(document.documentElement.getAttribute("data-theme") === "dark");
    fetch("/api/ha-status")
      .then((r) => r.json())
      .then(setHa)
      .catch(() => setHa(null));
  }, []);

  function toggleDark() {
    const next = !darkMode;
    setDarkMode(next);
    if (next) {
      document.documentElement.setAttribute("data-theme", "dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
      localStorage.setItem("theme", "light");
    }
  }

  return (
    <div className="max-w-lg">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text2)" }}>Appearance and Home Assistant</p>
      </div>

      <div className="p-5 rounded-2xl mb-4" style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}>
        <h2 className="font-medium mb-4">Appearance</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Dark mode</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text3)" }}>Saved in your browser</p>
          </div>
          <button
            onClick={toggleDark}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all"
            style={{
              background: darkMode ? "var(--accent-dim)" : "var(--surface2)",
              color: darkMode ? "var(--accent)" : "var(--text2)",
              border: "1px solid var(--border)",
            }}
          >
            {darkMode ? <Moon size={14} /> : <Sun size={14} />}
            {darkMode ? "Dark" : "Light"}
          </button>
        </div>
      </div>

      <div className="p-5 rounded-2xl space-y-3 mb-4" style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}>
        <h2 className="font-medium">Home Assistant</h2>
        {ha ? (
          <div className="space-y-1">
            <p className="text-sm" style={{ color: ha.reachable ? "var(--green)" : "var(--red)" }}>
              {ha.reachable ? `Connected to ${ha.url}` : ha.error ?? "Not connected"}
            </p>
            <p className="text-sm" style={{ color: ha.listening ? "var(--green)" : "var(--text3)" }}>
              {ha.listening ? "Listening for Done / Tomorrow / Later taps" : "Not listening for button taps yet"}
            </p>
          </div>
        ) : (
          <p className="text-sm" style={{ color: "var(--text3)" }}>Checking connection…</p>
        )}
        <p className="text-sm" style={{ color: "var(--text2)" }}>
          The house connection is <code className="text-xs">HA_URL</code> and <code className="text-xs">HA_TOKEN</code> in the Pi <code className="text-xs">.env</code> — one token for everyone.
          Sweepy listens for the notification buttons on that connection, so you do not need a Home Assistant automation for Done / Tomorrow / Later.
        </p>
        {ha && ha.services.length > 0 && (
          <div>
            <p className="text-xs mb-1.5" style={{ color: "var(--text3)" }}>Notify services HA will accept</p>
            <ul className="space-y-1">
              {ha.services.map((s) => (
                <li key={s} className="text-xs font-mono" style={{ color: "var(--text2)" }}>{s}</li>
              ))}
            </ul>
          </div>
        )}
        {ha && ha.people.length > 0 && (
          <div>
            <p className="text-xs mb-1.5" style={{ color: "var(--text3)" }}>People</p>
            <ul className="space-y-1.5">
              {ha.people.map((p) => (
                <li key={p.name} className="text-sm">
                  <span className="font-medium">{p.name}</span>
                  <span className="text-xs font-mono ml-2" style={{ color: p.ok ? "var(--text2)" : "var(--red)" }}>
                    {p.target || "—"}
                    {p.resolved && p.resolved !== p.target ? ` → ${p.resolved}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className="text-xs" style={{ color: "var(--text3)" }}>
          Optional backup webhook if the live listener is down: <span className="font-mono">{webhookUrl || "/api/ha-webhook"}</span>
        </p>
      </div>

      <div className="p-5 rounded-2xl mb-4" style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}>
        <h2 className="font-medium mb-3">HA log</h2>
        {!ha || ha.log.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text3)" }}>Nothing yet. Bell on People and Done / Tomorrow taps show up here.</p>
        ) : (
          <ul className="space-y-2">
            {ha.log.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => setOpenLogId(openLogId === row.id ? null : row.id)}
                  className="w-full text-left"
                >
                  <div className="flex items-start gap-2">
                    <span className="text-xs font-mono shrink-0 mt-0.5" style={{ color: "var(--text3)" }}>
                      {format(new Date(row.createdAt), "HH:mm")}
                    </span>
                    <span className="text-sm min-w-0" style={{ color: row.ok ? "var(--text)" : "var(--red)" }}>
                      {row.summary}
                    </span>
                  </div>
                </button>
                {openLogId === row.id && row.detail && (
                  <pre className="mt-1.5 ml-10 text-xs font-mono whitespace-pre-wrap break-all px-3 py-2 rounded-xl" style={{ background: "var(--surface2)", color: "var(--text2)" }}>
                    {row.detail}
                  </pre>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <Link
        href="/history"
        className="flex items-center gap-3 p-5 rounded-2xl mb-4"
        style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}
      >
        <span
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "var(--accent-dim)", color: "var(--accent)" }}
        >
          <ScrollText size={16} />
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-medium">Completion history</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text3)" }}>A timeline of everything that’s been checked off</p>
        </div>
      </Link>

      <div className="p-5 rounded-2xl" style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}>
        <h2 className="font-medium mb-3">How it works</h2>
        <ul className="space-y-2">
          {[
            "At midnight, due tasks are auto-assigned based on each person's daily capacity and allowed days",
            "At each person's notify time, one push notification fires per task with Done, Tomorrow, and Later",
            "Done checks it off. Tomorrow moves it to the next day. Later closes it and pings again in an hour",
            "Tasks can be checked off or deferred in the Today and Upcoming views too",
            "A day you pick for a chore stays put. If that day goes over someone's points, extras slide to the next day — auto-picks first",
          ].map((line) => (
            <li key={line} className="flex gap-2.5 text-sm" style={{ color: "var(--text2)" }}>
              <span style={{ color: "var(--accent-light)", marginTop: "2px" }}>·</span>
              {line}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
