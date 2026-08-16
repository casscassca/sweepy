"use client";
import { useState } from "react";
import { format } from "date-fns";

type Person = { id: string; name: string; color: string };

export default function CompleteAsMenu({
  users,
  defaultDate,
  onPick,
  onClose,
}: {
  users: Person[];
  defaultDate?: string;
  onPick: (userId: string, date: string) => void;
  onClose: () => void;
}) {
  const today = format(new Date(), "yyyy-MM-dd");
  const [date, setDate] = useState(defaultDate && defaultDate <= today ? defaultDate : today);

  return (
    <div
      className="absolute right-2 top-full mt-1 z-20 rounded-xl shadow-xl p-2 min-w-44"
      style={{ background: "var(--surface)", border: "1px solid var(--border-hover)" }}
    >
      <p className="text-xs px-2 py-1 mb-0.5" style={{ color: "var(--text3)" }}>Mark done as</p>
      <label className="block px-2 mb-2">
        <span className="sr-only">Completion date</span>
        <input
          type="date"
          max={today}
          value={date}
          onChange={(e) => setDate(e.target.value || today)}
          className="w-full text-sm"
        />
      </label>
      {users.map((u) => (
        <button
          key={u.id}
          type="button"
          onClick={() => onPick(u.id, date)}
          className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-sm transition-colors hover:bg-black/5"
        >
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: u.color }} />
          {u.name}
        </button>
      ))}
      <button type="button" onClick={onClose} className="w-full text-xs px-2 py-1 mt-0.5 rounded-lg" style={{ color: "var(--text3)" }}>
        Cancel
      </button>
    </div>
  );
}
