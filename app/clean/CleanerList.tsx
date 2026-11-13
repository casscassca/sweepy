"use client";
import { useEffect, useState } from "react";
import { Check } from "lucide-react";

type Line = { taskId: string; layer: "base" | "addon" | "addon2"; name: string; done: boolean };
type Section = { id: string; name: string; icon: string; lines: Line[] };

function lineKey(line: Line) {
  return `${line.taskId}:${line.layer}`;
}

export default function CleanerList() {
  const [status, setStatus] = useState<"loading" | "locked" | "off" | "ready">("loading");
  const [sections, setSections] = useState<Section[]>([]);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function load() {
    const res = await fetch("/api/clean");
    if (res.status === 401) {
      setStatus("locked");
      return;
    }
    if (res.status === 403) {
      setStatus("off");
      return;
    }
    if (!res.ok) {
      setStatus("locked");
      return;
    }
    const data = await res.json();
    setSections(Array.isArray(data.sections) ? data.sections : []);
    setStatus("ready");
  }

  useEffect(() => { void load(); }, []);

  async function unlock(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/clean/unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    if (!res.ok) {
      setError("That code didn’t work");
      return;
    }
    setCode("");
    await load();
  }

  async function mark(line: Line) {
    if (line.done || busy) return;
    const key = lineKey(line);
    setBusy(key);
    setSections((prev) => prev.map((section) => ({
      ...section,
      lines: section.lines.map((row) => lineKey(row) === key ? { ...row, done: true } : row),
    })));
    const res = await fetch("/api/clean/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId: line.taskId, layer: line.layer }),
    });
    setBusy(null);
    if (!res.ok) await load();
  }

  async function sendNote(e: React.FormEvent) {
    e.preventDefault();
    const body = note.trim();
    if (!body || sending) return;
    setSending(true);
    const res = await fetch("/api/clean/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    setSending(false);
    if (res.ok) {
      setNote("");
      setSent(true);
    }
  }

  if (status === "loading") {
    return <p className="p-8 text-sm text-center" style={{ color: "var(--text3)" }}>Loading…</p>;
  }

  if (status === "off") {
    return (
      <div className="min-h-full flex items-center justify-center px-5 py-16">
        <p className="text-sm text-center max-w-sm" style={{ color: "var(--text2)" }}>
          This list isn’t turned on yet. Set a 4-digit code in Sweepy settings.
        </p>
      </div>
    );
  }

  if (status === "locked") {
    return (
      <div className="min-h-full flex items-center justify-center px-5 py-16">
        <form onSubmit={unlock} className="w-full max-w-sm rounded-2xl p-6 space-y-4" style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Cleaning</h1>
            <p className="text-sm mt-1" style={{ color: "var(--text3)" }}>Enter the 4-digit code</p>
          </div>
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{4}"
            maxLength={4}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
            className="w-full text-center text-lg tracking-[0.4em]"
            aria-label="4-digit code"
          />
          {error && <p className="text-sm" style={{ color: "var(--red)" }}>{error}</p>}
          <button type="submit" disabled={code.length !== 4} className="w-full px-4 py-2.5 rounded-xl text-sm font-medium text-white" style={{ background: "var(--accent)", opacity: code.length === 4 ? 1 : 0.5 }}>
            Continue
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight mb-1">Cleaning</h1>
      <p className="text-sm mb-6" style={{ color: "var(--text3)" }}>Check off what you finished</p>
      <div className="space-y-6">
        {sections.map((section) => (
          <section key={section.id}>
            <h2 className="text-sm font-medium mb-2" style={{ color: "var(--text3)" }}>
              {section.icon} {section.name}
            </h2>
            <div className="space-y-1.5">
              {section.lines.map((line) => (
                <button
                  key={lineKey(line)}
                  type="button"
                  onClick={() => mark(line)}
                  disabled={line.done}
                  className="flex items-center gap-3 w-full text-left px-3 py-3 rounded-xl"
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    opacity: line.done ? 0.55 : 1,
                  }}
                >
                  <span className="shrink-0" style={{ color: line.done ? "var(--green)" : "var(--text3)" }}>
                    {line.done ? <Check size={20} /> : <span className="block w-5 h-5 rounded-full" style={{ border: "1.5px solid var(--border)" }} />}
                  </span>
                  <span className="text-sm" style={{ textDecoration: line.done ? "line-through" : "none" }}>{line.name}</span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
      <form onSubmit={sendNote} className="mt-8 space-y-3">
        <label className="block text-sm font-medium" htmlFor="cleaner-else">Anything else?</label>
        <textarea
          id="cleaner-else"
          value={note}
          onChange={(e) => { setNote(e.target.value); setSent(false); }}
          rows={3}
          maxLength={2000}
          placeholder="Other things you got done"
          className="w-full"
        />
        <button type="submit" disabled={!note.trim() || sending} className="px-4 py-2.5 rounded-xl text-sm font-medium text-white" style={{ background: "var(--accent)", opacity: note.trim() && !sending ? 1 : 0.5 }}>
          {sending ? "Sending…" : "Send"}
        </button>
        {sent && <p className="text-sm" style={{ color: "var(--green)" }}>Sent. Thanks.</p>}
      </form>
    </div>
  );
}
