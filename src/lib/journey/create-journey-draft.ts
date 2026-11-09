export type JourneyGoal = {
  title: string;
  targetDate?: string;
  weeklyAvailabilityDays?: number;
};

export type JourneyMission = {
  id: string;
  title: string;
  week: number;
  status: "pending";
};

export type JourneyDraft = {
  title: string;
  weeks: number;
  missions: JourneyMission[];
  requiresUserConfirmation: true;
};

/**
 * Produces a predictable, editable starting draft.
 * No points, rewards or external actions are granted here.
 * Persist only after authentication and explicit user confirmation.
 */
export function createJourneyDraft(goal: JourneyGoal, today = new Date()): JourneyDraft {
  const title = goal.title.trim().replace(/\s+/g, " ");
  if (!title || title.length > 160) {
    throw new Error("Informe um objetivo entre 1 e 160 caracteres.");
  }
  const days = goal.weeklyAvailabilityDays ?? 3;
  if (!Number.isInteger(days) || days < 1 || days > 7) {
    throw new Error("Disponibilidade semanal deve ser de 1 a 7 dias.");
  }
  if (Number.isNaN(today.getTime())) throw new Error("Data inicial inválida.");
  let weeks = 4;
  if (goal.targetDate) {
    const target = new Date(goal.targetDate + "T12:00:00Z");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(goal.targetDate) ||
        Number.isNaN(target.getTime()) ||
        target.toISOString().slice(0, 10) !== goal.targetDate) {
      throw new Error("Data-alvo inválida.");
    }
    const startDay = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
    const diff = target.getTime() - startDay;
    if (diff < 0) throw new Error("A data-alvo não pode estar no passado.");
    weeks = Math.max(1, Math.min(52, Math.ceil((diff + 1) / (7 * 86400000))));
  }
  const missions: JourneyMission[] = [];
  for (let week = 1; week <= weeks; week++) {
    missions.push({
      id: `week-${week}-plan`,
      title: `Planejar uma ação concreta para: ${title}`,
      week,
      status: "pending",
    });
    missions.push({
      id: `week-${week}-review`,
      title: `Revisar progresso e ajustar o próximo passo (${days} dia(s)/semana disponíveis)`,
      week,
      status: "pending",
    });
  }
  return { title, weeks, missions, requiresUserConfirmation: true };
}
