import type { VyraMetrics } from "./vyra-metrics";

export type VyraInsight = {
  id: string;
  title: string;
  description: string;
  severity: "positive" | "neutral" | "attention";
};

export function generateVyraInsights(
  metrics: VyraMetrics
): VyraInsight[] {
  const insights: VyraInsight[] = [];

  if (metrics.total === 0) {
    return [{
      id: "getting-started",
      title: "Comece sua jornada",
      description: "Cadastre sua primeira tarefa para receber análises de produtividade.",
      severity: "neutral",
    }];
  }

  const completionRate = metrics.completed / metrics.total;

  if (completionRate >= 0.8) {
    insights.push({
      id: "high-performance",
      title: "Excelente ritmo de execução",
      description: "Você concluiu pelo menos 80% das tarefas cadastradas.",
      severity: "positive",
    });
  }

  if (metrics.overdue > 0) {
    insights.push({
      id: "overdue-tasks",
      title: "Tarefas atrasadas precisam de atenção",
      description: `Existem ${metrics.overdue} tarefas atrasadas. Revise os prazos e reorganize suas prioridades.`,
      severity: "attention",
    });
  }

  if (metrics.openHighPriority >= 3) {
    insights.push({
      id: "priority-overload",
      title: "Atenção às tarefas de alta prioridade",
      description: `Você possui ${metrics.openHighPriority} tarefas de alta prioridade ainda pendentes. Revise quais precisam de atenção primeiro e organize sua execução.`,
      severity: "attention",
    });
  }
  if (metrics.pending > metrics.completed) {
    insights.push({
      id: "pending-work",
      title: "Oportunidade de ganhar ritmo",
      description: "Você possui mais tarefas pendentes do que concluídas. Considere priorizar entregas menores.",
      severity: "neutral",
    });
  }

  if (insights.length === 0) {
    if (metrics.pending > 0) {
      insights.push({
        id: "next-action",
        title: "Transforme planejamento em execução",
        description: `Você concluiu ${metrics.completed} de ${metrics.total} tarefas e possui ${metrics.pending} pendentes. Revise as prioridades e escolha uma tarefa para avançar hoje.`,
        severity: "neutral",
      });
    } else {
      insights.push({
        id: "all-completed",
        title: "Todas as tarefas foram concluídas",
        description: "Você não possui tarefas pendentes. Aproveite para revisar suas próximas metas.",
        severity: "positive",
      });
    }
  }

  return insights;
}