export type TaskMetric = {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  priority: string | null;
  completed_at: string | null;
};

export type VyraMetrics = {
  total: number;
  completed: number;
  pending: number;
  overdue: number;
  todo: number;
  inProgress: number;
  waiting: number;
  highPriority: number;
  openHighPriority: number;
  mediumPriority: number;
  lowPriority: number;
  otherPriority: number;
};

export function getCompletionRate(metrics: VyraMetrics): number {
  return metrics.total > 0
    ? Math.round((metrics.completed / metrics.total) * 100)
    : 0;
}

export function calculateVyraMetrics(
  tasks: TaskMetric[],
  today: string
): VyraMetrics {
  const completed = tasks.filter(
    (task) => task.status === "done"
  ).length;

  const priority = (task: TaskMetric) =>
    task.priority?.trim().toLowerCase() ?? "";

  return {
    total: tasks.length,
    completed,
    pending: tasks.length - completed,
    overdue: tasks.filter(
      (task) =>
        task.status !== "done" &&
        task.due_date !== null &&
        task.due_date.slice(0, 10) < today
    ).length,
    todo: tasks.filter((task) => task.status === "todo").length,
    inProgress: tasks.filter(
      (task) => task.status === "in_progress"
    ).length,
    waiting: tasks.filter(
      (task) => task.status === "waiting"
    ).length,
    highPriority: tasks.filter(
      (task) => priority(task) === "alta"
    ).length,
    openHighPriority: tasks.filter(
      (task) =>
        task.status !== "done" &&
        priority(task) === "alta"
    ).length,
    mediumPriority: tasks.filter(
      (task) => priority(task) === "média"
    ).length,
    lowPriority: tasks.filter(
      (task) => priority(task) === "baixa"
    ).length,
    otherPriority: tasks.filter(
      (task) =>
        !["alta", "média", "baixa"].includes(priority(task))
    ).length,
  };
}