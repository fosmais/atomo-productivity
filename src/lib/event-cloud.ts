import { createClient } from "@/lib/supabase/client";

export type EventType = "appointment" | "unavailable";

export type CalendarEvent = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  location: string | null;
  notes: string | null;
  eventType: EventType;
  blocksTime: boolean;
};

export type NewCalendarEvent = {
  title: string;
  startsAt: string;
  endsAt: string;
  location?: string;
  notes?: string;
  eventType?: EventType;
  blocksTime?: boolean;
};

async function getAuthenticatedUser() {
  const supabase = createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("Usuário não autenticado.");
  }

  return { supabase, userId: user.id };
}

export async function getCloudEvents(): Promise<CalendarEvent[]> {
  const { supabase, userId } = await getAuthenticatedUser();

  const { data, error } = await supabase
    .from("events")
    .select(
      "id, title, starts_at, ends_at, location, notes, event_type, blocks_time"
    )
    .eq("user_id", userId)
    .order("starts_at", { ascending: true })
    .limit(200);

  if (error) throw new Error(error.message);

  return (data ?? []).map((event) => ({
    id: event.id,
    title: event.title,
    startsAt: event.starts_at,
    endsAt: event.ends_at,
    location: event.location,
    notes: event.notes,
    eventType: event.event_type as EventType,
    blocksTime: event.blocks_time,
  }));
}

export async function saveCloudEvent(
  event: NewCalendarEvent
): Promise<void> {
  const { supabase, userId } = await getAuthenticatedUser();

  const title = event.title.trim();
  const start = new Date(event.startsAt);
  const end = new Date(event.endsAt);

  if (!title || title.length > 200) {
    throw new Error("Informe um título de até 200 caracteres.");
  }

  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    end <= start
  ) {
    throw new Error("Informe um período válido para o evento.");
  }

  const eventType = event.eventType ?? "appointment";
  const blocksTime = event.blocksTime ?? false;

  if (
    eventType !== "appointment" &&
    eventType !== "unavailable"
  ) {
    throw new Error("Tipo de evento inválido.");
  }

  const { error } = await supabase.from("events").insert({
    user_id: userId,
    title,
    starts_at: start.toISOString(),
    ends_at: end.toISOString(),
    location: event.location?.trim() || null,
    notes: event.notes?.trim() || null,
    event_type: eventType,
    blocks_time: blocksTime,
  });

  if (error) throw new Error(error.message);
}

export async function deleteCloudEvent(eventId: string): Promise<void> {
  const { supabase, userId } = await getAuthenticatedUser();

  const { error } = await supabase
    .from("events")
    .delete()
    .eq("id", eventId)
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
}
