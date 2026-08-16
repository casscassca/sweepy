"use client";
import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

export default function TaskNote({ notes }: { notes?: string | null }) {
  const text = notes?.trim();
  const [open, setOpen] = useState(false);
  if (!text) return null;

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-0.5 text-xs"
        style={{ color: "var(--text3)" }}
        aria-expanded={open}
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        Note
      </button>
      {open && (
        <p className="text-xs mt-1 whitespace-pre-wrap" style={{ color: "var(--text2)" }}>
          {text}
        </p>
      )}
    </div>
  );
}
