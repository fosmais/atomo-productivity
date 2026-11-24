import type { TimeInterval } from "./availability-engine";
import type { SchedulingTask } from "./smart-scheduling";

export type WhatNowRecommendation = {
  taskId: string;
  title: string;
  durationMinutes: number;
  priority: number;
  start: Date;
  end: Date;
  reason: string;
};

export function recommendWhatNow(
  tasks: SchedulingTask[],
  availableIntervals: TimeInterval[],
  now: Date = new Date()
): WhatNowRecommendation | null {
  const nowMs = now.getTime();

  if (!Number.isFinite(nowMs)) {
    throw new Error("Data atual inválida.");
  }

  const currentWindows = availableIntervals
    .map((interval) => ({
      start: interval.start.getTime(),
      end: interval.end.getTime(),
    }))
    .filter(
      (interval) =>
        Number.isFinite(interval.start) &&
        Number.isFinite(interval.end) &&
        interval.start <= nowMs &&
        interval.end > nowMs
    );

  if (currentWindows.length === 0) {
    return null;
  }

  const availableMinutes = Math.max(
    ...currentWindows.map(
      (interval) => (interval.end - nowMs) / 60_000
    )
  );

  const candidates = tasks
    .filter(
      (task) =>
        Number.isFinite(task.durationMinutes) &&
        task.durationMinutes >= 5 &&
        Number.isFinite(task.priority) &&
        task.durationMinutes <= availableMinutes
    )
    .sort(
      (a, b) =>
        b.priority - a.priority ||
        a.durationMinutes - b.durationMinutes ||
        a.id.localeCompare(b.id)
    );

  const selected = candidates[0];

  if (!selected) {
    return null;
  }

  const end = new Date(
    nowMs + selected.durationMinutes * 60_000
  );

  return {
    taskId: selected.id,
    title: selected.title,
    durationMinutes: selected.durationMinutes,
    priority: selected.priority,
    start: new Date(nowMs),
    end,
    reason:
      selected.priority >= 3
        ? "Tarefa de alta prioridade que cabe no seu tempo livre atual."
        : selected.priority >= 2
          ? "Tarefa importante que pode ser concluída nesta janela livre."
          : "Tarefa que cabe no tempo disponível agora.",
  };
}
