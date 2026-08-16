import { dirtWord, roomDirtiness } from "@/lib/dirtiness";
import DirtGauge from "./DirtGauge";

type TaskDirt = { lastDoneAt: Date | string | null; frequencyDays: number };

export default function RoomDirtGauge({ tasks }: { tasks: TaskDirt[] }) {
  const ratio = tasks.length === 0 ? 0 : roomDirtiness(tasks);
  const word = tasks.length === 0 ? "no chores" : dirtWord(ratio);
  return (
    <DirtGauge
      ratio={ratio}
      title={`${word} · ${tasks.length} chore${tasks.length === 1 ? "" : "s"}`}
      label={`Room is ${word}`}
    />
  );
}
