import type { TaskMetric } from "./vyra-metrics";

export type VyraRankedTask = {
  task: TaskMetric;
  score: number;
  reason: string;
};

function priorityPoints(priority: string | null): number {
  switch (priority?.trim().toLowerCase()) {
    case "alta":
      return 15;
    case "media":
    case "média":
      return 10;
    case "baixa":
      return 5;
    default:
      return 0;
  }
}

function dateOnly(value: string | null): string | null {
  return value?.slice(0, 10) ?? null;
}

export function rankVyraTasks(
  tasks: TaskMetric[],
  today: string,
  limit = 3
): VyraRankedTask[] {
  const ranked = tasks
    .filter((task) => task.status !== "done")
    .map((task) => {
      const due = dateOnly(task.due_date);
      const priority = priorityPoints(task.priority);

      let base = 20;
      let reason = "Tarefa pendente que pode ser planejada.";

      if (due && due < today) {
        base = 80;
        reason = "Prazo vencido: atenção imediata.";
      } else if (due === today) {
        base = 65;
        reason = "Vence hoje: priorize esta entrega.";
      } else if (due) {
        base = 40;
        reason = "Entrega futura com prazo definido.";
      } else if (priority === 15) {
        reason = "Prioridade alta, ainda sem prazo definido.";
      }

      return {
        task,
        score: Math.min(100, base + priority),
        reason,
      };
    });

  return ranked
    .sort((a, b) => {
      const scoreDifference = b.score - a.score;
      if (scoreDifference !== 0) return scoreDifference;

      const dueDifference = (
        dateOnly(a.task.due_date) ?? "9999-12-31"
      ).localeCompare(
        dateOnly(b.task.due_date) ?? "9999-12-31"
      );

      if (dueDifference !== 0) return dueDifference;

      return a.task.id.localeCompare(b.task.id);
    })
    .slice(0, Math.max(0, limit));
}