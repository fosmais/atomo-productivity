export type CopilotPriority = "Alta" | "Média" | "Normal";

export type CopilotTask = {
  id: string;
  title: string;
  priority: CopilotPriority;
  dueDate: string | null;
  completed: boolean;
  estimatedMinutes?: number;
};

export type DailyPlanItem = {
  taskId: string;
  title: string;
  priority: CopilotPriority;
  estimatedMinutes: number;
  reason: string;
};

export type DailyPlan = {
  items: DailyPlanItem[];
  totalMinutes: number;
  availableMinutes: number;
  pendingCount: number;
  deferredCount: number;
};

const priorityScore: Record<CopilotPriority, number> = {
  Alta: 30,
  Média: 20,
  Normal: 10,
};

const defaultMinutes: Record<CopilotPriority, number> = {
  Alta: 60,
  Média: 45,
  Normal: 30,
};

function getDueDateScore(dueDate: string | null, today: string): number {
  if (!dueDate) return 0;

  const due = Date.parse(`${dueDate.slice(0, 10)}T00:00:00Z`);
  const current = Date.parse(`${today.slice(0, 10)}T00:00:00Z`);

  if (!Number.isFinite(due) || !Number.isFinite(current)) {
    return 0;
  }

  const days = Math.round((due - current) / 86400000);

  if (days < 0) return 50;
  if (days === 0) return 40;
  if (days === 1) return 25;
  if (days <= 3) return 15;

  return 0;
}

export function generateDailyPlan(
  tasks: CopilotTask[],
  availableMinutes: number,
  today: string
): DailyPlan {
  const budget = Math.max(0, Math.floor(availableMinutes));

  const pending = tasks.filter((task) => !task.completed);

  const ranked = pending
    .map((task) => ({
      ...task,
      score:
        priorityScore[task.priority] +
        getDueDateScore(task.dueDate, today),
      estimatedMinutes:
        task.estimatedMinutes && task.estimatedMinutes > 0
          ? Math.ceil(task.estimatedMinutes)
          : defaultMinutes[task.priority],
    }))
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));

  const items: DailyPlanItem[] = [];
  let totalMinutes = 0;

  for (const task of ranked) {
    if (totalMinutes + task.estimatedMinutes > budget) {
      continue;
    }

    let reason = "Tarefa selecionada por prioridade.";

    if (task.dueDate && task.dueDate.slice(0, 10) < today) {
      reason = "Prazo vencido: requer atenção.";
    } else if (task.dueDate?.slice(0, 10) === today) {
      reason = "Prazo de entrega hoje.";
    } else if (task.priority === "Alta") {
      reason = "Alta prioridade.";
    }

    items.push({
      taskId: task.id,
      title: task.title,
      priority: task.priority,
      estimatedMinutes: task.estimatedMinutes,
      reason,
    });

    totalMinutes += task.estimatedMinutes;
  }

  return {
    items,
    totalMinutes,
    availableMinutes: budget,
    pendingCount: pending.length,
    deferredCount: pending.length - items.length,
  };
}
