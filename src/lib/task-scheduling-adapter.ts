import type { SchedulingTask } from "@/lib/smart-scheduling";

export type CloudSchedulingTask = {
  id: string;
  title: string;
  priority: string;
  duration_minutes: number | null;
  completed: boolean;
};

export type TaskSchedulingPreparation = {
  ready: SchedulingTask[];
  missingDuration: CloudSchedulingTask[];
};

function priorityWeight(priority: string): number {
  switch (priority.trim().toLowerCase()) {
    case "alta":
      return 3;

    case "média":
    case "media":
      return 2;

    case "normal":
      return 1;

    default:
      return 1;
  }
}

export function prepareTasksForScheduling(
  tasks: CloudSchedulingTask[]
): TaskSchedulingPreparation {
  const ready: SchedulingTask[] = [];
  const missingDuration: CloudSchedulingTask[] = [];

  for (const task of tasks) {
    if (task.completed) {
      continue;
    }

    const duration = task.duration_minutes;

    if (
      duration === null ||
      !Number.isInteger(duration) ||
      duration < 5 ||
      duration > 1440
    ) {
      missingDuration.push(task);
      continue;
    }

    ready.push({
      id: task.id,
      title: task.title,
      priority: priorityWeight(task.priority),
      durationMinutes: duration,
    });
  }

  return {
    ready,
    missingDuration,
  };
}
