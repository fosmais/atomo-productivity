import { createBrowserClient } from "@supabase/ssr";
import type { SavedPlan, SavedTask } from "@/lib/plan-storage";

const priorities = ["Alta", "Média", "Normal"] as const;
type Priority = (typeof priorities)[number];

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error("Supabase não configurado.");
  }

  return createBrowserClient(url, key);
}

async function getAuthenticatedUser() {
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    throw new Error("Faça login para acessar seus planos.");
  }

  return { supabase, userId: data.user.id };
}

function isPriority(value: string): value is Priority {
  return priorities.some((priority) => priority === value);
}

export async function getCloudPlans(): Promise<SavedPlan[]> {
  const { supabase, userId } = await getAuthenticatedUser();

  const { data: plans, error: plansError } = await supabase
    .from("plans")
    .select("id, title, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (plansError) throw plansError;
  if (!plans?.length) return [];

  const { data: tasks, error: tasksError } = await supabase
    .from("tasks")
    .select("id, plan_id, title, priority, due_date, completed")
    .eq("user_id", userId)
    .in(
      "plan_id",
      plans.map((plan) => plan.id)
    );

  if (tasksError) throw tasksError;

  return plans.map((plan) => ({
    id: plan.id,
    name: plan.title,
    createdAt: plan.created_at,
    tasks: (tasks ?? [])
      .filter((task) => task.plan_id === plan.id)
      .map((task) => {
        if (!isPriority(task.priority)) {
          throw new Error("Um plano contém uma prioridade inválida.");
        }

        return {
          id: task.id,
          title: task.title,
          priority: task.priority,
          dueDate: task.due_date,
          completed: task.completed,
        };
      }),
  }));
}

export async function saveCloudPlan(
  name: string,
  tasks: SavedTask[]
): Promise<SavedPlan> {
  const { supabase, userId } = await getAuthenticatedUser();

  const { data: plan, error } = await supabase
    .from("plans")
    .insert({
      user_id: userId,
      title: name.trim() || "Plano sem título",
    })
    .select("id, title, created_at")
    .single();

  if (error) throw error;

  if (tasks.length > 0) {
    const { error: tasksError } = await supabase.from("tasks").insert(
      tasks.map((task) => ({
        plan_id: plan.id,
        user_id: userId,
        title: task.title,
        priority: task.priority,
        due_date: task.dueDate || null,
        completed: task.completed,
      }))
    );

    if (tasksError) {
      const { error: rollbackError } = await supabase
        .from("plans")
        .delete()
        .eq("id", plan.id)
        .eq("user_id", userId);

      if (rollbackError) {
        throw new AggregateError(
          [tasksError, rollbackError],
          "A gravação das tarefas e a remoção do plano incompleto falharam."
        );
      }

      throw tasksError;
    }
  }

  return {
    id: plan.id,
    name: plan.title,
    createdAt: plan.created_at,
    tasks: tasks.map((task) => ({ ...task })),
  };
}

export async function deleteCloudPlan(id: string): Promise<void> {
  const { supabase, userId } = await getAuthenticatedUser();

  const { error: tasksError } = await supabase
    .from("tasks")
    .delete()
    .eq("plan_id", id)
    .eq("user_id", userId);

  if (tasksError) throw tasksError;

  const { error } = await supabase
    .from("plans")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw error;
}
