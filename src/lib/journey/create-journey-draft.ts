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
  // Travel goals need concrete, sequential decisions rather than generic weekly filler.
  // This intentionally runs before the language-learning match (e.g. "viagem para Itália").
  const isTravel = /viagem|viajar|ferias|turismo|visitar|roteiro|passagens/.test(normalized);
  const travelSteps = [
    ["Escolher as cidades e o tipo de experiência desejada", "Anotar as cidades favoritas e decidir quais priorizar"],
    ["Conferir o calendário e definir uma janela de datas", "Registrar datas possíveis e eventuais restrições"],
    ["Estimar o orçamento total da viagem", "Separar limites para passagem, estadia, alimentação e passeios"],
    ["Pesquisar a faixa de preço das passagens", "Comparar opções e registrar alertas de preço"],
    ["Verificar validade do passaporte e documentos necessários", "Consultar fontes oficiais e listar pendências documentais"],
    ["Pesquisar requisitos de entrada aplicáveis à viagem", "Salvar fontes oficiais e os prazos que precisam ser conferidos"],
    ["Escolher a duração ideal em cada cidade", "Montar um primeiro roteiro com deslocamentos realistas"],
    ["Pesquisar bairros e regiões para hospedagem", "Comparar localização, acesso ao transporte e custo"],
    ["Pesquisar opções de transporte entre cidades", "Registrar alternativas de trem, ônibus ou voo e seus custos"],
    ["Criar uma reserva financeira específica para a viagem", "Conferir quanto já foi reservado e o que falta"],
    ["Listar experiências e atrações prioritárias", "Escolher o que exige reserva antecipada"],
    ["Pesquisar a melhor época para cada passeio", "Ajustar o roteiro considerando horários e deslocamentos"],
    ["Comparar hospedagens adequadas ao roteiro", "Selecionar opções com políticas de cancelamento claras"],
    ["Definir uma estratégia para compra de passagens", "Revisar orçamento e decidir quando comprar, sem pressa"],
    ["Revisar cobertura de seguro e necessidades pessoais", "Registrar dúvidas e conferir condições das opções"],
    ["Planejar transporte local e chegada ao destino", "Anotar aeroportos, estações e trajetos até a hospedagem"],
    ["Conferir meios de pagamento e custos no exterior", "Preparar alternativas de pagamento e orçamento diário"],
    ["Pesquisar conectividade e aplicativos úteis", "Organizar mapas, reservas e contatos em um só lugar"],
    ["Preparar uma lista de bagagem adequada à época", "Revisar itens essenciais e regras de transporte"],
    ["Organizar comprovantes e documentos de viagem", "Salvar cópias acessíveis e conferir o que ainda falta"],
    ["Revisar reservas, horários e políticas", "Identificar pendências sem marcar compras como concluídas"],
    ["Criar um roteiro diário flexível", "Equilibrar passeios, refeições e tempo livre"],
    ["Planejar imprevistos e contatos de emergência", "Anotar alternativas de transporte e suporte"],
    ["Conferir o checklist final de embarque", "Revisar documentos, bagagem e horários"],
    ["Celebrar a preparação e visualizar o destino", "Registrar o que foi realizado e os próximos passos reais"],
  ];
  let action = `Definir e executar uma ação concreta para: ${title}`;
  let review = "Registrar o resultado e escolher o próximo passo";
  let progression: string[] | undefined;
  if (/italian|ingles|espanhol|frances|idioma|lingua|language/.test(normalized)) {
    action = "Praticar vocabulário, escuta e conversação no idioma escolhido";
    review = "Revisar o vocabulário aprendido e registrar uma conversa ou exercício";
    progression = [action, "Praticar frases úteis e escutar diálogos curtos", "Conversar ou escrever sobre situações reais", "Revisar dificuldades e demonstrar o que aprendeu"];
  } else if (/corr|caminh|maraton|quilometr|\b5\s?km\b|\b10\s?km\b/.test(normalized)) {
    action = "Realizar um treino progressivo de caminhada ou corrida conforme seu condicionamento";
    review = "Registrar distância, duração e recuperação antes do próximo treino";
    progression = [action, "Alternar treinos leves e recuperação respeitando os limites", "Ajustar gradualmente duração ou distância sem forçar", "Revisar evolução e planejar o próximo ciclo de treinos"];
  } else if (/economiz|poup|junt|guardar dinheiro|reserva financeira/.test(normalized)) {
    action = "Definir um valor viável para guardar e revisar despesas da semana";
    review = "Conferir o valor reservado e ajustar a meta sem comprometer gastos essenciais";
    progression = [action, "Separar uma quantia possível e anotar gastos", "Revisar despesas e manter aportes sustentáveis", "Conferir o acumulado e recalcular o próximo período"];
  } else if (/muda|morar fora|imigra|outro pais/.test(normalized)) {
    action = "Pesquisar um requisito prático da mudança e registrar a próxima providência";
    review = "Atualizar o checklist de documentos, prazos e orçamento da mudança";
    progression = [action, "Organizar documentos e estimar custos e prazos", "Verificar exigências oficiais e pendências prioritárias", "Revisar checklist e definir próximos passos da mudança"];
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
    const stageIndex = Math.min(3, Math.floor(((week - 1) * 4) / weeks));
    const stage = stages[stageIndex];
    const weeklyAction = progression?.[stageIndex] ?? action;
    const travelStep = travelSteps[Math.min(travelSteps.length - 1, Math.floor((week - 1) * travelSteps.length / weeks))];
    missions.push({
      id: `week-${week}-plan`,
      title: isTravel ? `Semana ${week}: ${travelStep[0]}` : `Semana ${week}: ${stage}. ${weeklyAction} (${days} dia(s) disponíveis)`.slice(0, 160),
      week,
      status: "pending",
    });
    missions.push({
      id: `week-${week}-review`,
      title: isTravel ? `Semana ${week}: ${travelStep[1]}` : `Semana ${week}: ${review}`.slice(0, 160),
      week,
      status: "pending",
    });
  }
  return { title, ...(goal.targetDate ? { targetDate: goal.targetDate } : {}), plannedOn: today.toISOString().slice(0, 10), weeks, missions, requiresUserConfirmation: true };
}
