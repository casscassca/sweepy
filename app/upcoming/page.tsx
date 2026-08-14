"use client";
import { useEffect, useState, type HTMLAttributes } from "react";
import { format, parseISO, isToday, isTomorrow } from "date-fns";
import {
  DndContext, DragEndEvent, PointerSensor, useSensor, useSensors, closestCenter,
  DragOverlay, DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, CheckCircle2, Circle, Pencil, X, RefreshCw } from "lucide-react";
import { dirtColor, dirtDetail, dirtinessRatio } from "@/lib/dirtiness";
import TaskEditModal from "@/components/TaskEditModal";
import type { TaskFormTask } from "@/components/TaskFormFields";

type User = { id: string; name: string; color: string };
type Task = TaskFormTask & { room: { name: string } };
type Assignment = { id: string; userId: string; date: string; order: number; completedAt: string | null; task: Task; user: User };

const DIFF_COLOR = ["", "#a78bfa", "#fb923c", "#f87171"];
const DIFF_LABEL = ["", "quick", "medium", "big job"];

function dayLabel(dateStr: string) {
  const d = parseISO(dateStr);
  if (isToday(d)) return "Today";
  if (isTomorrow(d)) return "Tomorrow";
  return format(d, "EEEE, MMM d");
}

function TaskCard({ assignment, users, onComplete, onUncomplete, onRemove, onEdit, dragHandleProps, isDragOverlay }: {
  assignment: Assignment; users: User[];
  onComplete?: (id: string, by: string) => void;
  onUncomplete?: (id: string) => void;
  onRemove?: (id: string) => void;
  onEdit?: (task: Task) => void;
  dragHandleProps?: HTMLAttributes<HTMLElement>;
  isDragOverlay?: boolean;
}) {
  const [showWho, setShowWho] = useState(false);
  const done = !!assignment.completedAt;

  return (
    <div
      className="flex items-center gap-2 pl-1.5 pr-3 py-2.5 rounded-xl mb-1.5 relative group"
      style={{
        background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow)",
        opacity: isDragOverlay ? 0.9 : 1,
      }}
    >
      <div
        className="cursor-grab touch-none p-0.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity shrink-0"
        style={{ color: "var(--text3)" }}
        {...dragHandleProps}
      >
        <GripVertical size={14} />
      </div>
      {onComplete && (
        <button onClick={() => done ? onUncomplete?.(assignment.id) : setShowWho(true)} aria-label={done ? "Mark incomplete" : "Mark complete"} className="shrink-0 min-h-11 w-9 flex items-center justify-center -ml-1" style={{ color: done ? "var(--green)" : "var(--text3)" }}>
          {done ? <CheckCircle2 size={20} /> : <Circle size={20} />}
        </button>
      )}
      <div className="flex-1 min-w-0">
        <span className="text-sm" style={{ opacity: done ? 0.35 : 1, textDecoration: done ? "line-through" : "none" }}>
          {assignment.task.name}
        </span>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: assignment.user.color }} />
          <span className="text-xs" style={{ color: "var(--text3)" }}>{assignment.user.name}</span>
          <span className="text-xs" style={{ color: "var(--text3)" }}>{assignment.task.room.name}</span>
          <span className="text-xs font-medium px-1.5 py-px rounded-full" style={{ background: DIFF_COLOR[assignment.task.difficulty] + "22", color: DIFF_COLOR[assignment.task.difficulty] }}>
            {DIFF_LABEL[assignment.task.difficulty]}
          </span>
          {!done && (
            <span
              className="w-4 h-4 rounded-full shrink-0"
              style={{ background: dirtColor(dirtinessRatio(assignment.task.lastDoneAt, assignment.task.frequencyDays)) }}
              title={dirtDetail(assignment.task.lastDoneAt, assignment.task.frequencyDays)}
              aria-label={dirtDetail(assignment.task.lastDoneAt, assignment.task.frequencyDays)}
            />
          )}
        </div>
      </div>
      <div className="flex items-center shrink-0">
        {onEdit && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onEdit(assignment.task); }}
            className="p-2 rounded-lg opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
            style={{ color: "var(--text3)" }}
            aria-label="Edit task"
          >
            <Pencil size={16} />
          </button>
        )}
        {onRemove && (
          <button onClick={() => onRemove(assignment.id)} className="p-2 rounded-lg opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity" style={{ color: "var(--text3)" }} aria-label="Remove task">
            <X size={16} />
          </button>
        )}
      </div>
      {showWho && (
        <div className="absolute right-2 top-full mt-1 z-20 rounded-xl shadow-xl p-1.5 min-w-40" style={{ background: "var(--surface)", border: "1px solid var(--border-hover)" }}>
          <p className="text-xs px-2 py-1 mb-0.5" style={{ color: "var(--text3)" }}>Who did this?</p>
          {users.map((u) => (
            <button key={u.id} onClick={() => { onComplete?.(assignment.id, u.id); setShowWho(false); }} className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-sm transition-colors hover:bg-black/5">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: u.color }} />{u.name}
            </button>
          ))}
          <button onClick={() => setShowWho(false)} className="w-full text-xs px-2 py-1 mt-0.5 rounded-lg" style={{ color: "var(--text3)" }}>Cancel</button>
        </div>
      )}
    </div>
  );
}

function SortableTaskCard(props: Parameters<typeof TaskCard>[0]) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.assignment.id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.3 : 1 }}>
      <TaskCard {...props} dragHandleProps={{ ...attributes, ...listeners }} />
    </div>
  );
}

type WhoFilter = "all" | "me" | string;

function FilterChip({
  label, color, active, onClick,
}: {
  label: string; color?: string; active: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium shrink-0 transition-all"
      style={{
        background: active ? (color ? color + "22" : "var(--accent-dim)") : "var(--surface)",
        color: active ? (color ?? "var(--accent)") : "var(--text2)",
        border: `2px solid ${active ? (color ?? "var(--accent)") : "var(--border)"}`,
        boxShadow: active ? "none" : "var(--shadow)",
      }}
    >
      {color && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />}
      {label}
    </button>
  );
}

export default function UpcomingPage() {
  const [days, setDays] = useState<string[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [me, setMe] = useState<User | null>(null);
  const [who, setWho] = useState<WhoFilter>("all");
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  async function load() {
    setLoading(true);
    const [upcomingRes, usersRes, meRes] = await Promise.all([
      fetch("/api/upcoming").then((r) => r.json()),
      fetch("/api/users").then((r) => r.json()),
      fetch("/api/auth/me").then((r) => r.json()),
    ]);
    setDays(upcomingRes.days);
    setAssignments(upcomingRes.assignments);
    setUsers(usersRes);
    setMe(meRes.user ?? null);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function complete(assignmentId: string, completedById: string) {
    await fetch("/api/complete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assignmentId, completedById }) });
    load();
  }

  async function uncomplete(assignmentId: string) {
    await fetch("/api/complete", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assignmentId }) });
    load();
  }

  async function remove(assignmentId: string) {
    await fetch(`/api/assignments/${assignmentId}`, { method: "DELETE" });
    setAssignments((prev) => prev.filter((a) => a.id !== assignmentId));
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const activeAssignment = assignments.find((a) => a.id === activeId);

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    if (!over || active.id === over.id) return;

    const draggedId = active.id as string;
    const overId = over.id as string;

    // over.id might be a date string (dropped on day container) or another assignment id
    const overAssignment = assignments.find((a) => a.id === overId);
    const targetDate = overAssignment?.date ?? overId;

    if (!days.includes(targetDate)) return; // invalid drop target

    const dragged = assignments.find((a) => a.id === draggedId);
    if (!dragged || dragged.date === targetDate) return;

    // Optimistic update
    setAssignments((prev) => prev.map((a) => a.id === draggedId ? { ...a, date: targetDate } : a));

    await fetch(`/api/assignments/${draggedId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: targetDate }),
    });
  }

  const others = users.filter((u) => u.id !== me?.id);
  const visible = who === "all"
    ? assignments
    : who === "me"
      ? assignments.filter((a) => a.userId === me?.id)
      : assignments.filter((a) => a.userId === who);
  const totalDone = visible.filter((a) => a.completedAt).length;

  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Upcoming</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text2)" }}>
            Next 7 days · {visible.length} tasks · {totalDone} done
          </p>
        </div>
        <button onClick={load} disabled={loading} className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text2)", boxShadow: "var(--shadow)" }}>
          <RefreshCw size={13} className={loading ? "spin" : ""} />
          Refresh
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto mb-3 py-1 -mx-1 px-1">
        <FilterChip label="All" active={who === "all"} onClick={() => setWho("all")} />
        {me && (
          <FilterChip label="Me" color={me.color} active={who === "me"} onClick={() => setWho("me")} />
        )}
        {others.map((u) => (
          <FilterChip
            key={u.id}
            label={u.name}
            color={u.color}
            active={who === u.id}
            onClick={() => setWho(u.id)}
          />
        ))}
      </div>

      {loading ? (
        <div className="text-center py-20" style={{ color: "var(--text3)" }}>Planning your week…</div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={(e: DragStartEvent) => setActiveId(e.active.id as string)}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveId(null)}
        >
          <div className="space-y-6">
            {days.map((date) => {
              const dayAssignments = visible.filter((a) => a.date === date).sort((a, b) => a.order - b.order);
              const donePct = dayAssignments.length > 0 ? (dayAssignments.filter((a) => a.completedAt).length / dayAssignments.length) * 100 : 0;
              const isCurrentDay = date === days[0];

              return (
                <div key={date}>
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="font-semibold text-sm" style={{ color: isCurrentDay ? "var(--accent)" : "var(--text)" }}>
                      {dayLabel(date)}
                    </h2>
                    <span className="text-xs" style={{ color: "var(--text3)" }}>
                      {dayAssignments.length} tasks · {dayAssignments.reduce((s, a) => s + a.task.difficulty, 0)} pts
                    </span>
                    {dayAssignments.length > 0 && (
                      <div className="flex-1 h-0.5 rounded-full overflow-hidden" style={{ background: "var(--surface2)" }}>
                        <div className="h-full rounded-full" style={{ width: `${donePct}%`, background: isCurrentDay ? "var(--accent)" : "var(--green)" }} />
                      </div>
                    )}
                  </div>

                  <SortableContext items={dayAssignments.map((a) => a.id)} strategy={verticalListSortingStrategy}>
                    <div className="min-h-10">
                      {dayAssignments.map((a) => (
                        <SortableTaskCard
                          key={a.id}
                          assignment={a}
                          users={users}
                          onComplete={isCurrentDay ? complete : undefined}
                          onUncomplete={isCurrentDay ? uncomplete : undefined}
                          onRemove={remove}
                          onEdit={setEditingTask}
                        />
                      ))}
                      {dayAssignments.length === 0 && (
                        <div className="text-sm py-4 text-center rounded-xl" style={{ color: "var(--text3)", border: "1px dashed var(--border)" }}>
                          Nothing scheduled — drag tasks here
                        </div>
                      )}
                    </div>
                  </SortableContext>
                </div>
              );
            })}
          </div>

          <DragOverlay>
            {activeAssignment && (
              <TaskCard assignment={activeAssignment} users={users} isDragOverlay />
            )}
          </DragOverlay>
        </DndContext>
      )}

      {editingTask && (
        <TaskEditModal
          task={editingTask}
          users={users}
          onClose={() => setEditingTask(null)}
          onSaved={() => { setEditingTask(null); load(); }}
        />
      )}
    </div>
  );
}
