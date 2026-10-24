export type SavedTask = {
  id?: string;
  title: string;
  priority: "Alta" | "Média" | "Normal";
  dueDate: string | null;
  completed: boolean;
};

export type SavedPlan = {
  id: string;
  name: string;
  createdAt: string;
  tasks: SavedTask[];
};

const STORAGE_KEY = "atomo-productivity-plans-v1";
const MAX_PLANS = 50;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSavedTask(value: unknown): value is SavedTask {
  return (
    isRecord(value) &&
    (value.id === undefined || typeof value.id === "string") &&
    typeof value.title === "string" &&
    (value.priority === "Alta" ||
      value.priority === "Média" ||
      value.priority === "Normal") &&
    (typeof value.dueDate === "string" || value.dueDate === null) &&
    typeof value.completed === "boolean"
  );
}

function isSavedPlan(value: unknown): value is SavedPlan {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.createdAt === "string" &&
    Array.isArray(value.tasks) &&
    value.tasks.every(isSavedTask)
  );
}

function readPlans(): SavedPlan[] {
  if (typeof window === "undefined") return [];

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];

  let data: unknown;

  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("Os planos salvos não puderam ser lidos.");
  }

  if (!Array.isArray(data) || !data.every(isSavedPlan)) {
    throw new Error("Os planos salvos têm um formato inválido.");
  }

  return data.slice(0, MAX_PLANS);
}

function writePlans(plans: SavedPlan[]): void {
  if (typeof window === "undefined") {
    throw new Error("O armazenamento de planos só está disponível no navegador.");
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(plans));
}

export function getSavedPlans(): SavedPlan[] {
  return readPlans();
}

export function savePlan(name: string, tasks: SavedTask[]): SavedPlan {
  const plan: SavedPlan = {
    id: crypto.randomUUID(),
    name: name.trim().slice(0, 100) || "Plano sem título",
    createdAt: new Date().toISOString(),
    tasks: tasks.map((task) => ({ ...task })),
  };

  const plans = [plan, ...readPlans()].slice(0, MAX_PLANS);
  writePlans(plans);

  return plan;
}

export function deletePlan(id: string): void {
  writePlans(readPlans().filter((plan) => plan.id !== id));
}

export function updateSavedPlan(plan: SavedPlan): void {
  if (!isSavedPlan(plan)) {
    throw new Error("O plano informado tem um formato inválido.");
  }

  writePlans(
    readPlans().map((savedPlan) =>
      savedPlan.id === plan.id ? plan : savedPlan
    )
  );
}
