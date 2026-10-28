import { createClient } from "@/lib/supabase/client";
import {
  calculateVyraMetrics,
  type TaskMetric,
  type VyraMetrics,
} from "./vyra-metrics";

async function loadVyraTasks(): Promise<TaskMetric[]> {
  const supabase = createClient();

  const { data: auth, error: authError } =
    await supabase.auth.getUser();

  if (authError || !auth.user) {
    throw new Error("Faça login para visualizar seus indicadores.");
  }

  const tasks: TaskMetric[] = [];
  const pageSize = 1000;
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from("tasks")
      .select("id, title, status, due_date, priority, completed_at")
      .eq("user_id", auth.user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) throw error;

    const page = (data ?? []) as TaskMetric[];
    tasks.push(...page);

    if (page.length < pageSize) break;

    offset += pageSize;
  }

  return tasks;
}

export async function loadVyraMetrics(): Promise<VyraMetrics> {
  const tasks = await loadVyraTasks();

  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Sao_Paulo",
  });

  return calculateVyraMetrics(tasks, today);
}

export async function loadVyraCompletionHistory(): Promise<TaskMetric[]> {
  return loadVyraTasks();
}