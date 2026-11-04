import { createClient } from "@/lib/supabase/client";

export type ReminderLeadMinutes = 5 | 10 | 15 | 30 | 60 | 1440;

export async function scheduleEventReminder(eventId: string, minutesBefore: ReminderLeadMinutes): Promise<void> {
  const supabase = createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) throw new Error("Faça login para configurar o lembrete.");

  const { data: event, error: eventError } = await supabase.from("events")
    .select("id, starts_at").eq("id", eventId).eq("user_id", auth.user.id)
    .is("deleted_at", null).maybeSingle();
  if (eventError) throw new Error(eventError.message);
  if (!event) throw new Error("Compromisso não encontrado.");

  const startsAt = new Date(event.starts_at).getTime();
  const remindAt = startsAt - minutesBefore * 60_000;
  if (!Number.isFinite(remindAt) || startsAt <= Date.now() || remindAt <= Date.now()) {
    throw new Error("Escolha uma antecedência que ainda esteja no futuro.");
  }

  const { error } = await supabase.from("event_reminders").insert({
    user_id: auth.user.id,
    event_id: eventId,
    minutes_before: minutesBefore,
    remind_at: new Date(remindAt).toISOString(),
    channel: "in_app",
    status: "pending",
  });
  if (error) {
    if (error.code === "23505") throw new Error("Este lembrete já está configurado para o compromisso.");
    throw new Error(error.message);
  }
}

export async function listEventReminders(eventId: string) {
  const supabase = createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) throw new Error("Faça login para visualizar lembretes.");
  const { data, error } = await supabase.from("event_reminders")
    .select("id, minutes_before, remind_at, status")
    .eq("user_id", auth.user.id).eq("event_id", eventId)
    .order("remind_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}
