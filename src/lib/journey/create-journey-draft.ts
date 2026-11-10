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
  const isStudyAbroad = /intercambio|estudar no exterior|estudar fora|curso no exterior/.test(normalized);
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
  const studyAbroadSteps = [
    ["Definir o objetivo do intercâmbio: idioma, curso ou formação", "Anotar resultados desejados e critérios para escolher o programa"],
    ["Pesquisar escolas e programas no destino", "Selecionar três opções com informações verificáveis"],
    ["Comparar duração, carga horária e datas de início", "Escolher uma janela compatível com trabalho e orçamento"],
    ["Levantar custos de curso, matrícula e materiais", "Montar uma estimativa de investimento em educação"],
    ["Pesquisar custo de vida no destino", "Estimar gastos com moradia, alimentação e transporte"],
    ["Comparar programas e condições de cancelamento", "Organizar vantagens, limitações e dúvidas para as escolas"],
    ["Solicitar informações oficiais das escolas selecionadas", "Registrar respostas e requisitos de matrícula"],
    ["Verificar requisitos migratórios para nacionalidade e duração", "Conferir orientações oficiais e listar documentos necessários"],
    ["Conferir validade do passaporte e documentos pessoais", "Preparar uma lista de pendências documentais"],
    ["Definir o orçamento completo e uma reserva para imprevistos", "Revisar valores estimados e capacidade de pagamento"],
    ["Pesquisar acomodação estudantil e outras opções", "Comparar segurança, deslocamento e condições contratuais"],
    ["Verificar transporte entre acomodação e escola", "Estimar duração e custo do deslocamento diário"],
    ["Comparar passagens aéreas e janelas de chegada", "Registrar alternativas sem realizar compra automática"],
    ["Avaliar cobertura de saúde e seguro aplicável", "Conferir exigências da escola e autoridades competentes"],
    ["Reunir comprovantes solicitados pela escola", "Verificar o que falta antes de enviar qualquer documentação"],
    ["Revisar contrato, taxas e política de reembolso do curso", "Decidir sobre matrícula somente após conferir as condições"],
    ["Organizar cronograma de pagamentos e reservas", "Verificar prazos e autorizar individualmente cada compromisso"],
    ["Planejar rotina de estudos e prática do idioma", "Definir sessões semanais realistas de preparação"],
    ["Pesquisar cultura local e orientações para estudantes", "Anotar costumes, segurança e contatos úteis"],
    ["Planejar chegada ao aeroporto e transporte inicial", "Guardar alternativas de traslado e rotas até a acomodação"],
    ["Organizar meios de pagamento e conectividade", "Preparar opções para internet e gastos cotidianos"],
    ["Preparar bagagem conforme clima e regras de transporte", "Conferir itens essenciais e limites da companhia"],
    ["Conferir matrícula, hospedagem e documentos de entrada", "Revisar confirmações e pendências sem presumir aprovações"],
    ["Montar checklist dos primeiros dias no destino", "Planejar orientação na escola, transporte e necessidades básicas"],
    ["Revisar a preparação final para o intercâmbio", "Celebrar o avanço e identificar o que ainda exige confirmação"],
  ];
  // Concrete educational progression for AI study goals, instead of generic habit reminders.
  const isAiEducation = /(?:\bmba\b.*(?:\bia\b|inteligencia artificial)|(?:\bia\b|inteligencia artificial).*(?:\bmba\b|curso|estud|aprender)|machine learning|ciencia de dados|data science)/.test(normalized);
  const aiLessons = [
    ["Entender IA, machine learning e IA generativa com três exemplos reais", "Explicar com suas palavras a diferença entre IA, ML e modelos generativos"],
    ["Estudar dados de treino, validação, teste e risco de vazamento", "Criar uma tabela simples de dados e identificar possíveis vieses"],
    ["Aprender classificação, regressão e métricas de avaliação", "Escolher métricas adequadas para dois problemas de negócio"],
    ["Praticar prompts estruturados com contexto, objetivo e critérios", "Comparar duas respostas de IA e registrar limitações e melhorias"],
    ["Explorar embeddings, busca semântica e RAG", "Desenhar um fluxo de perguntas e respostas com fontes verificáveis"],
    ["Estudar privacidade, segurança, LGPD e uso responsável da IA", "Revisar um caso de uso e listar riscos e controles necessários"],
    ["Planejar um pequeno projeto aplicado de IA", "Definir problema, dados, indicadores e um protótipo viável"],
    ["Apresentar o projeto e avaliar o aprendizado", "Produzir uma demonstração curta e registrar próximos estudos"],
  ];
  let action = `Definir e executar uma ação concreta para: ${title}`;
  let progression: string[] | undefined;
  if (/italian|ingles|espanhol|frances|idioma|lingua|language/.test(normalized)) {
    action = "Praticar vocabulário, escuta e conversação no idioma escolhido";
    progression = [action, "Praticar frases úteis e escutar diálogos curtos", "Conversar ou escrever sobre situações reais", "Revisar dificuldades e demonstrar o que aprendeu"];
  } else if (/corr|caminh|maraton|quilometr|\b5\s?km\b|\b10\s?km\b/.test(normalized)) {
    action = "Realizar um treino progressivo de caminhada ou corrida conforme seu condicionamento";
    progression = [action, "Alternar treinos leves e recuperação respeitando os limites", "Ajustar gradualmente duração ou distância sem forçar", "Revisar evolução e planejar o próximo ciclo de treinos"];
  } else if (/economiz|poup|junt|guardar dinheiro|reserva financeira/.test(normalized)) {
    action = "Definir um valor viável para guardar e revisar despesas da semana";
    progression = [action, "Separar uma quantia possível e anotar gastos", "Revisar despesas e manter aportes sustentáveis", "Conferir o acumulado e recalcular o próximo período"];
  } else if (/muda|morar fora|imigra|outro pais/.test(normalized)) {
    action = "Pesquisar um requisito prático da mudança e registrar a próxima providência";
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
    const weeklyChecks = [
      "Registrar o ponto de partida e identificar um obstáculo real",
      "Anotar o que foi realizado e o que ainda precisa de atenção",
      "Comparar o resultado com a semana anterior e ajustar uma ação",
      "Revisar o tempo dedicado e escolher uma melhoria viável",
      "Registrar uma evidência concreta do progresso alcançado",
      "Identificar o principal aprendizado e definir o próximo passo",
      "Conferir se o ritmo cabe na rotina e ajustar o planejamento",
      "Revisar os avanços do ciclo e definir uma pequena conquista seguinte",
    ];
    const weeklyReview = progression
      ? weeklyChecks[(week - 1) % weeklyChecks.length]
      : week === 1 ? "Registrar o ponto de partida e escolher como medir o progresso"
      : weeklyChecks[(week - 1) % weeklyChecks.length];
    const steps = isStudyAbroad ? studyAbroadSteps : travelSteps;
    const travelStep = steps[Math.min(steps.length - 1, Math.floor((week - 1) * steps.length / weeks))];
    const aiLesson = aiLessons[Math.min(aiLessons.length - 1, Math.floor((week - 1) * aiLessons.length / weeks))];
    missions.push({
      id: `week-${week}-plan`,
      title: isStudyAbroad || isTravel ? `Semana ${week}: ${travelStep[0]}` : isAiEducation ? `Semana ${week}: Aula prática — ${aiLesson[0]}` : `Semana ${week}: ${stage}. ${weeklyAction} (${days} dia(s) disponíveis)`.slice(0, 160),
      week,
      status: "pending",
    });
    missions.push({
      id: `week-${week}-review`,
      title: isStudyAbroad || isTravel ? `Semana ${week}: ${travelStep[1]}` : isAiEducation ? `Semana ${week}: Exercício — ${aiLesson[1]}` : `Semana ${week}: ${weeklyReview}`.slice(0, 160),
      week,
      status: "pending",
    });
  }
  return { title, ...(goal.targetDate ? { targetDate: goal.targetDate } : {}), plannedOn: today.toISOString().slice(0, 10), weeks, missions, requiresUserConfirmation: true };
}
