import { createClient } from "@/lib/supabase/client";

import {
  prepareTasksForScheduling,
  type CloudSchedulingTask,
  type TaskSchedulingPreparation,
} from "@/lib/task-scheduling-adapter";

export async function getCloudTasksForScheduling():
  Promise<TaskSchedulingPreparation> {
  const supabase = createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Usuário não autenticado.");
  }

  const { data, error } = await supabase
    .from("tasks")
    .select(
      "id, title, priority, duration_minutes, completed"
    )
    .eq("user_id", user.id)
    .eq("completed", false);

  if (error) {
    throw new Error(
      `Erro ao consultar tarefas: ${error.message}`
    );
  }

  const tasks: CloudSchedulingTask[] = data ?? [];

  return prepareTasksForScheduling(tasks);
}

export async function updateTaskDuration(
  taskId: string,
  durationMinutes: number
): Promise<void> {
  if (
    !taskId ||
    !Number.isInteger(durationMinutes) ||
    durationMinutes < 5 ||
    durationMinutes > 1440
  ) {
    throw new Error(
      "Informe uma duração entre 5 e 1440 minutos."
    );
  }

  const supabase = createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Usuário não autenticado.");
  }

  const { data, error } = await supabase
    .from("tasks")
    .update({
      duration_minutes: durationMinutes,
    })
    .eq("id", taskId)
    .eq("user_id", user.id)
    .eq("completed", false)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error(
      "Tarefa não encontrada ou sem permissão para atualização."
    );
  }
}
