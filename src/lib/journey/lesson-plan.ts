/**
 * MIKA Professora: deterministic, side-effect-free lesson proposal.
 * No calendar writes, rewards, or progress mutations occur here.
 */
export type LessonProposalInput = {
  journeyId: string;
  goal: string;
  topic?: string;
  level?: string;
  durationMinutes?: number;
  language?: string;
  completedTopics?: string[];
};

export type LessonProposal = {
  journeyId: string;
  title: string;
  objective: string;
  durationMinutes: number;
  level: string;
  language: string;
  activities: string[];
  assessment: string;
  requiresConfirmation: true;
};

function clean(value: string | undefined, max: number): string {
  return (value ?? "").trim().replace(/\s+/g, " ").slice(0, max);
}

/** A proposal, not an appointment or a claim that a lesson was completed. */
export function proposeMikaLesson(input: LessonProposalInput): LessonProposal {
  const journeyId = clean(input.journeyId, 100);
  const goal = clean(input.goal, 160);
  if (!journeyId || !goal) throw new Error("Jornada e objetivo são obrigatórios.");
  const duration = input.durationMinutes ?? 20;
  if (!Number.isInteger(duration) || duration < 10 || duration > 120) {
    throw new Error("Duração deve estar entre 10 e 120 minutos.");
  }
  const topic = clean(input.topic, 120) || goal;
  const level = clean(input.level, 40) || "iniciante";
  const language = clean(input.language, 40) || "pt-BR";
  const completed = (input.completedTopics ?? []).filter((x) => typeof x === "string").map((x) => clean(x, 120));
  const review = completed.length ? completed[completed.length - 1] : "";
  return {
    journeyId,
    title: `Aula: ${topic}`,
    objective: `Praticar ${topic} com exemplos e demonstrar compreensão sobre ${goal}.`,
    durationMinutes: duration,
    level,
    language,
    activities: [
      review ? `Revisar o conteúdo anterior: ${review}` : `Diagnosticar o conhecimento prévio sobre ${topic}`,
      `Explicar ${topic} com exemplos adequados ao nível ${level}`,
      `Conduzir uma atividade prática sobre ${topic}`,
      "Solicitar resposta do aluno e oferecer correção fundamentada",
    ],
    assessment: `Pedir ao aluno que aplique ${topic} em um exemplo novo; registrar avaliação somente após resposta efetiva.`,
    requiresConfirmation: true,
  };
}
