import type { TaskMetric } from "./vyra-metrics";

export type VyraTaskRecommendation = {
  task: TaskMetric;
  reason: string;
};

function priorityScore(priority: string | null): number {
  switch (priority?.trim().toLowerCase()) {
    case "alta":
      return 3;
    case "média":
    case "media":
      return 2;
    case "baixa":
      return 1;
    default:
      return 0;
  }
}

function dueDate(task: TaskMetric): string | null {
  return task.due_date?.slice(0, 10) ?? null;
}

function urgencyScore(task: TaskMetric, today: string): number {
  const due = dueDate(task);

  if (!due) return 0;
  if (due < today) return 4;
  if (due === today) return 3;

  return 2;
}

export function recommendNextTask(
  tasks: TaskMetric[],
  today: string
): VyraTaskRecommendation | null {
  const pending = tasks.filter(
    (task) => task.status !== "done"
  );

  if (pending.length === 0) return null;

  const ranked = [...pending].sort((a, b) => {
    const urgencyDifference =
      urgencyScore(b, today) - urgencyScore(a, today);

    if (urgencyDifference !== 0) {
      return urgencyDifference;
    }

    const priorityDifference =
      priorityScore(b.priority) - priorityScore(a.priority);

    if (priorityDifference !== 0) {
      return priorityDifference;
    }

    const dueDifference =
      (dueDate(a) ?? "9999-12-31").localeCompare(
        dueDate(b) ?? "9999-12-31"
      );

    if (dueDifference !== 0) {
      return dueDifference;
    }

    return a.id.localeCompare(b.id);
  });

  const task = ranked[0];
  const due = dueDate(task);

  let reason: string;

  if (due && due < today) {
    reason = "Esta tarefa está atrasada e exige atenção imediata.";
  } else if (due === today) {
    reason = "Esta tarefa vence hoje e deve ser priorizada.";
  } else if (due && priorityScore(task.priority) === 3) {
    reason = "Esta tarefa combina prioridade alta com prazo definido.";
  } else if (due) {
    reason = "Esta tarefa possui uma entrega programada.";
  } else if (priorityScore(task.priority) === 3) {
    reason = "Esta tarefa possui prioridade alta e está pendente.";
  } else {
    reason = "Esta tarefa está pendente e pode ser sua próxima ação.";
  }

  return { task, reason };
}