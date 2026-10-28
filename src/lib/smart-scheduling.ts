import type { TimeInterval } from "@/lib/availability-engine";

export type SchedulingTask = {
  id: string;
  title: string;
  durationMinutes: number;
  priority: number;
};

export type ScheduledSuggestion = {
  taskId: string;
  title: string;
  priority: number;
  start: Date;
  end: Date;
};

export type SchedulingResult = {
  suggestions: ScheduledSuggestion[];
  unscheduled: SchedulingTask[];
};

export function suggestTaskSchedule(
  tasks: SchedulingTask[],
  availableIntervals: TimeInterval[]
): SchedulingResult {
  const sortedTasks = [...tasks].sort(
    (a, b) => b.priority - a.priority
  );

  const slots = availableIntervals
    .map((interval) => ({
      start: interval.start.getTime(),
      end: interval.end.getTime(),
    }))
    .filter(
      (slot) =>
        Number.isFinite(slot.start) &&
        Number.isFinite(slot.end) &&
        slot.start < slot.end
    )
    .sort((a, b) => a.start - b.start);

  // Normaliza intervalos sobrepostos para evitar
  // sugerir duas tarefas no mesmo horário.
  const normalizedSlots: typeof slots = [];

  for (const slot of slots) {
    const previous = normalizedSlots[normalizedSlots.length - 1];

    if (previous && slot.start <= previous.end) {
      previous.end = Math.max(previous.end, slot.end);
    } else {
      normalizedSlots.push({ ...slot });
    }
  }

  const suggestions: ScheduledSuggestion[] = [];
  const unscheduled: SchedulingTask[] = [];

  for (const task of sortedTasks) {
    if (
      !Number.isFinite(task.durationMinutes) ||
      task.durationMinutes <= 0 ||
      !Number.isFinite(task.priority)
    ) {
      unscheduled.push(task);
      continue;
    }

    const durationMs = task.durationMinutes * 60_000;

    const slot = normalizedSlots.find(
      (candidate) =>
        candidate.end - candidate.start >= durationMs
    );

    if (!slot) {
      unscheduled.push(task);
      continue;
    }

    const start = slot.start;
    const end = start + durationMs;

    suggestions.push({
      taskId: task.id,
      title: task.title,
      priority: task.priority,
      start: new Date(start),
      end: new Date(end),
    });

    slot.start = end;
  }

  return {
    suggestions: suggestions.sort(
      (a, b) => a.start.getTime() - b.start.getTime()
    ),
    unscheduled,
  };
}
