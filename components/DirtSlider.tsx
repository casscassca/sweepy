"use client";
import { useState } from "react";
import { DIRT_MAX, dirtColor, dirtinessRatio } from "@/lib/dirtiness";
import DirtGauge from "./DirtGauge";

export default function DirtSlider({
  lastDoneAt,
  frequencyDays,
  name = "dirtRatio",
  inputId = "dirt-ratio",
  label = "How dirty is it?",
  asOf,
}: {
  lastDoneAt?: string | null;
  frequencyDays?: number;
  name?: string;
  inputId?: string;
  label?: string;
  asOf?: Date;
}) {
  const [ratio, setRatio] = useState(() => dirtinessRatio(lastDoneAt ?? null, frequencyDays ?? 7, asOf));
  const color = dirtColor(ratio);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs" style={{ color: "var(--text3)" }} htmlFor={inputId}>
          {label}
        </label>
        <DirtGauge ratio={ratio} size={22} />
      </div>
      <input
        id={inputId}
        name={name}
        type="range"
        min={0}
        max={DIRT_MAX}
        step={0.1}
        value={ratio}
        onChange={(e) => setRatio(Number(e.target.value))}
        className="dirt-slider"
        style={{ color }}
        aria-valuemin={0}
        aria-valuemax={DIRT_MAX}
        aria-valuenow={ratio}
        aria-valuetext={ratio >= DIRT_MAX - 0.05 ? "Filthy" : ratio < 0.5 ? "Just cleaned" : `Due ${ratio.toFixed(1)}× over`}
      />
      <div className="flex justify-between mt-1.5 text-xs" style={{ color: "var(--text3)" }}>
        <span>Just cleaned</span>
        <span>Due</span>
        <span>Filthy</span>
      </div>
    </div>
  );
}
