"use client";
import { useEffect, useState } from "react";
import { Check, Moon, Sun } from "lucide-react";

export default function SettingsPage() {
  const [haUrl, setHaUrl] = useState("");
  const [haToken, setHaToken] = useState("");
  const [saved, setSaved] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then((s) => {
      setHaUrl(s.haUrl ?? "");
      setHaToken(s.haToken ?? "");
    });
    setWebhookUrl(`${window.location.origin}/api/ha-webhook`);
    setDarkMode(document.documentElement.getAttribute("data-theme") === "dark");
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

  async function save(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ haUrl, haToken }),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="max-w-lg">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text2)" }}>App config & Home Assistant connection</p>
      </div>

      {/* Appearance */}
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

      {/* Home Assistant */}
      <form
        onSubmit={save}
        className="p-5 rounded-2xl space-y-4 mb-4"
        style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}
      >
        <h2 className="font-medium">Home Assistant</h2>
        <div>
          <label className="block text-xs mb-1.5" style={{ color: "var(--text3)" }}>HA URL</label>
          <input value={haUrl} onChange={(e) => setHaUrl(e.target.value)} placeholder="http://homeassistant.local:8123" />
        </div>
        <div>
          <label className="block text-xs mb-1.5" style={{ color: "var(--text3)" }}>Long-lived access token</label>
          <input type="password" value={haToken} onChange={(e) => setHaToken(e.target.value)} placeholder="eyJ0eXAiOiJKV1..." />
          <p className="text-xs mt-1.5" style={{ color: "var(--text3)" }}>HA → Profile → Long-lived access tokens → Create token</p>
        </div>
        <button type="submit" className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white transition-all" style={{ background: saved ? "#16a34a" : "var(--accent)" }}>
          {saved && <Check size={14} />}
          {saved ? "Saved" : "Save settings"}
        </button>
      </form>

      {/* Webhook */}
      <div className="p-5 rounded-2xl space-y-3 mb-4" style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}>
        <h2 className="font-medium">Webhook URL</h2>
        <p className="text-sm" style={{ color: "var(--text2)" }}>
          Point your HA mobile notification action automation to this URL:
        </p>
        <div className="px-3 py-2.5 rounded-xl text-xs font-mono break-all" style={{ background: "var(--surface2)", color: "var(--accent)" }}>
          {webhookUrl || "http://your-server:3000/api/ha-webhook"}
        </div>
        <p className="text-xs" style={{ color: "var(--text3)" }}>
          Handles both <code>MARK_DONE_</code> and <code>DEFER_</code> notification actions.
        </p>
      </div>

      {/* How it works */}
      <div className="p-5 rounded-2xl" style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}>
        <h2 className="font-medium mb-3">How it works</h2>
        <ul className="space-y-2">
          {[
            "At midnight, due tasks are auto-assigned based on each person's daily capacity and allowed days",
            "At each person's notify time, one push notification fires per task with Done and Tomorrow buttons",
            "Tapping Tomorrow moves the task to the next day's queue",
            "Tasks can be checked off or deferred in the Today and Upcoming views too",
            "Overflow spills to future days automatically",
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
