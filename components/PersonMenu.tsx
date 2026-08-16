"use client";

type Person = { id: string; name: string; color: string };

export default function PersonMenu({
  title, users, selectedId, onPick, onClose,
}: {
  title: string; users: Person[]; selectedId?: string; onPick: (id: string) => void; onClose: () => void;
}) {
  return (
    <div className="absolute left-0 top-full mt-1 z-20 rounded-xl shadow-xl p-1.5 min-w-40" style={{ background: "var(--surface)", border: "1px solid var(--border-hover)" }}>
      <p className="text-xs px-2 py-1 mb-0.5" style={{ color: "var(--text3)" }}>{title}</p>
      {users.map((u) => (
        <button
          key={u.id}
          type="button"
          onClick={() => { onPick(u.id); onClose(); }}
          className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-sm transition-colors hover:bg-black/5"
          style={{ background: u.id === selectedId ? "var(--accent-dim)" : undefined }}
        >
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: u.color }} />
          {u.name}
        </button>
      ))}
      <button type="button" onClick={onClose} className="w-full text-xs px-2 py-1 mt-0.5 rounded-lg" style={{ color: "var(--text3)" }}>Cancel</button>
    </div>
  );
}
