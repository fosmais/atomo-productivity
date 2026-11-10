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
  targetDate?: string;
  weeks: number;
  plannedOn: string;
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
  if (!title || title.length > 120) {
    throw new Error("Informe um objetivo entre 1 e 120 caracteres.");
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
  // Transparent, deterministic starter missions. These are not AI-generated.
  // Keep generation stable so the confirmation endpoint can reconstruct the reviewed plan.
  const normalized = title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  let action = `Definir e executar uma ação concreta para: ${title}`;
  let review = "Registrar o resultado e escolher o próximo passo";
  if (/italian|ingles|espanhol|frances|idioma|lingua|language/.test(normalized)) {
    action = "Praticar vocabulário, escuta e conversação no idioma escolhido";
    review = "Revisar o vocabulário aprendido e registrar uma conversa ou exercício";
  } else if (/corr|caminh|maraton|quilometr|\b5\s?km\b|\b10\s?km\b/.test(normalized)) {
    action = "Realizar um treino progressivo de caminhada ou corrida conforme seu condicionamento";
    review = "Registrar distância, duração e recuperação antes do próximo treino";
  } else if (/economiz|poup|junt|guardar dinheiro|reserva financeira/.test(normalized)) {
    action = "Definir um valor viável para guardar e revisar despesas da semana";
    review = "Conferir o valor reservado e ajustar a meta sem comprometer gastos essenciais";
  } else if (/muda|morar fora|imigra|outro pais/.test(normalized)) {
    action = "Pesquisar um requisito prático da mudança e registrar a próxima providência";
    review = "Atualizar o checklist de documentos, prazos e orçamento da mudança";
  }
  // Stages are deterministic so confirmation reconstructs the exact reviewed preview.
  const stages = [
    "Preparação: estabelecer o ponto de partida e os recursos necessários",
    "Prática: executar a ação e registrar o que funcionou",
    "Evolução: aumentar gradualmente a consistência conforme a disponibilidade",
    "Consolidação: revisar conquistas e planejar a continuidade",
  ];
  const missions: JourneyMission[] = [];
  for (let week = 1; week <= weeks; week++) {
    const stage = stages[Math.min(3, Math.floor(((week - 1) * 4) / weeks))];
    missions.push({
      id: `week-${week}-plan`,
      title: `Semana ${week}: ${stage}. ${action} (${days} dia(s) disponíveis)`.slice(0, 160),
      week,
      status: "pending",
    });
    missions.push({
      id: `week-${week}-review`,
      title: `Semana ${week}: ${review}`.slice(0, 160),
      week,
      status: "pending",
    });
  }
  return { title, ...(goal.targetDate ? { targetDate: goal.targetDate } : {}), plannedOn: today.toISOString().slice(0, 10), weeks, missions, requiresUserConfirmation: true };
}
