"use client";
import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  onPick: (userId: string | null, date: string) => void;
  onClose: () => void;
}) {
  const today = format(new Date(), "yyyy-MM-dd");
  const [date, setDate] = useState(defaultDate && defaultDate <= today ? defaultDate : today);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    const menu = menuRef.current;
    if (!anchor || !menu) return;

    const place = () => {
      const r = anchor.getBoundingClientRect();
      const mh = menu.offsetHeight;
      const mw = menu.offsetWidth;
      const gap = 4;
      const spaceBelow = window.innerHeight - r.bottom - gap;
      const openUp = spaceBelow < mh && r.top > mh + gap;
      const top = openUp ? r.top - gap - mh : r.bottom + gap;
      const left = Math.min(Math.max(8, r.right - mw), window.innerWidth - mw - 8);
      setCoords({ top, left });
    };

    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [users.length, date]);

  const menu = (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} aria-hidden />
      <div
        ref={menuRef}
        role="dialog"
        aria-label="Mark done as"
        className="fixed z-50 rounded-xl shadow-xl p-2 min-w-44"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border-hover)",
          top: coords?.top ?? 0,
          left: coords?.left ?? 0,
          visibility: coords ? "visible" : "hidden",
        }}
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
        {users.length > 1 && (
          <button
            type="button"
            onClick={() => onPick(null, date)}
            className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-sm transition-colors hover:bg-black/5"
          >
            <span className="flex items-center shrink-0">
              {users.slice(0, 2).map((u, i) => (
                <span
                  key={u.id}
                  className="w-2 h-2 rounded-full"
                  style={{ background: u.color, marginLeft: i === 0 ? 0 : -3 }}
                />
              ))}
            </span>
            Both
          </button>
        )}
        <button type="button" onClick={onClose} className="w-full text-xs px-2 py-1 mt-0.5 rounded-lg" style={{ color: "var(--text3)" }}>
          Cancel
        </button>
      </div>
    </>
  );

  return (
    <>
      <span ref={anchorRef} className="absolute right-2 top-full w-0 h-0" aria-hidden />
      {typeof document !== "undefined" ? createPortal(menu, document.body) : null}
    </>
  );
}
