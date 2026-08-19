import { CircleAlert, Sparkles } from "lucide-react";
import { DIRT_SHOW_AT, cleanlinessPct, dirtColor, dirtWord, roomDirtiness } from "@/lib/dirtiness";

type TaskDirt = { lastDoneAt: Date | string | null; frequencyDays: number };

export default function RoomDirtGauge({ tasks, asOf }: { tasks: TaskDirt[]; asOf?: Date }) {
  const empty = tasks.length === 0;
  const ratio = empty ? 0 : roomDirtiness(tasks, asOf);
  const word = empty ? "no chores" : dirtWord(ratio);
  const justDone = !empty && ratio < DIRT_SHOW_AT / 3;
  const sparkling = !empty && cleanlinessPct(ratio) >= 80;
  const filthy = !empty && ratio >= 2;
  const cleanPct = empty ? 0 : cleanlinessPct(ratio);
  const color = justDone
    ? dirtColor(0, 0.4)
    : empty
      ? "var(--border)"
      : dirtColor(ratio, filthy ? 0.8 : 0.55);

  return (
    <span
      className="flex-1 min-w-10 flex items-center gap-1.5"
      title={`${word} · ${tasks.length} chore${tasks.length === 1 ? "" : "s"}`}
      aria-label={`Room is ${word}`}
    >
      <span
        className="block flex-1 h-1.5 rounded-full overflow-hidden"
        style={{ background: filthy ? "rgba(248, 113, 113, 0.18)" : "var(--surface2)" }}
      >
        <span
          className="block h-full rounded-full"
          style={{ width: `${cleanPct}%`, background: color }}
        />
      </span>
      {sparkling && (
        <Sparkles size={12} className="shrink-0" style={{ color: "var(--accent)", opacity: 0.5 }} aria-hidden />
      )}
      {filthy && (
        <CircleAlert size={12} className="shrink-0" style={{ color: "var(--red)" }} aria-hidden />
      )}
    </span>
  );
}
