export const EVENT_CATEGORIES = {
  work: { label: "Trabalho", color: "#3B82F6" },
  family: { label: "Família", color: "#F59E0B" },
  leisure: { label: "Lazer", color: "#10B981" },
  health: { label: "Saúde", color: "#EF4444" },
  personal: { label: "Pessoal", color: "#A855F7" },
  study: { label: "Estudos", color: "#06B6D4" },
} as const;

export type EventCategory = keyof typeof EVENT_CATEGORIES;

export function isEventCategory(value: unknown): value is EventCategory {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(EVENT_CATEGORIES, value);
}

export function suggestEventCategory(title: string): EventCategory {
  const value = title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/consulta|medico|dentista|exame|terapia|academia|treino|vacina/.test(value)) return "health";
  if (/reuniao|cliente|projeto|escritorio|plantao|trabalho|deploy/.test(value)) return "work";
  if (/filho|filha|familia|escola|pais|aniversario da/.test(value)) return "family";
  if (/curso|aula|estudar|prova|faculdade|idioma/.test(value)) return "study";
  if (/cinema|show|passeio|viagem|ferias|restaurante|parque/.test(value)) return "leisure";
  return "personal";
}
