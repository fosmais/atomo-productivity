import { isEventCategory, type EventCategory } from "./event-categories";
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
  category: EventCategory;
  concierge?: EventConcierge | null;
};

export type EventConcierge = { departureAddress: string | null; services: string[]; status: string };

export type NewCalendarEvent = {
  title: string;
  startsAt: string;
  endsAt: string;
  location?: string;
  notes?: string;
  eventType?: EventType;
  blocksTime?: boolean;
  category?: EventCategory;
  /** Explicitly allow a historical record; never enabled by default. */
  concierge?: { departureAddress: string; services: string[] };
  allowPast?: boolean;
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

  const pageSize = 500;
  const allEvents: CalendarEvent[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from("events")
      .select("id, title, starts_at, ends_at, location, notes, event_type, blocks_time, category")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("starts_at", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) throw new Error(error.message);
    const batch = data ?? [];
    allEvents.push(...batch.map((event) => ({
      id: event.id,
      title: event.title,
      startsAt: event.starts_at,
      endsAt: event.ends_at,
      location: event.location,
      notes: event.notes,
      eventType: event.event_type as EventType,
      blocksTime: event.blocks_time,
      category: isEventCategory(event.category) ? event.category : "personal",
    })));
    if (batch.length < pageSize) break;
  }
  if (allEvents.length === 0) return allEvents;
  const byEvent = new Map<string, { departure_address: string | null; services: string[]; status: string }>();
  for (let offset = 0; offset < allEvents.length; offset += 100) {
    const ids = allEvents.slice(offset, offset + 100).map(event => event.id);
    const { data: preferences, error: preferencesError } = await supabase.from("event_concierge")
      .select("event_id, departure_address, services, status")
      .eq("user_id", userId).in("event_id", ids);
    if (preferencesError) throw new Error("Não foi possível carregar as preferências do Concierge.");
    for (const item of preferences ?? []) byEvent.set(item.event_id, item);
  }
  return allEvents.map(event => {
    const item = byEvent.get(event.id);
    return { ...event, concierge: item ? { departureAddress: item.departure_address, services: item.services ?? [], status: item.status } : null };
  });
}

export async function saveCloudEvent(
  event: NewCalendarEvent
): Promise<void> {
  const { supabase, userId } = await getAuthenticatedUser();

  const title = event.title.trim();
  const start = new Date(event.startsAt);
  const end = new Date(event.endsAt);

  if (!title || title.length > 200 || !/[\p{L}\p{N}]/u.test(title)) {
    throw new Error("Informe um título de até 200 caracteres.");
  }

  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    end <= start
  ) {
    throw new Error("Informe um período válido para o evento.");
  }

  if (start.getTime() < Date.now() - 60_000 && event.allowPast !== true) {
    throw new Error("A data de início está no passado. Escolha um horário futuro ou registre explicitamente uma atividade histórica.");
  }

  if (event.category !== undefined && !isEventCategory(event.category)) throw new Error("Categoria inválida.");
  const eventType = event.eventType ?? "appointment";
  const blocksTime = event.blocksTime ?? false;

  if (
    eventType !== "appointment" &&
    eventType !== "unavailable"
  ) {
    throw new Error("Tipo de evento inválido.");
  }

  if (event.concierge) {
    if (eventType !== "appointment") throw new Error("O Concierge só pode ser ativado em compromissos.");
    if (!event.location?.trim()) throw new Error("Informe o destino do compromisso para ativar o Concierge.");
    if (typeof event.concierge.departureAddress !== "string" || event.concierge.departureAddress.length > 300) throw new Error("O endereço de partida deve ter até 300 caracteres.");
    if (!Array.isArray(event.concierge.services) || event.concierge.services.length > 4 || event.concierge.services.some(service => typeof service !== "string")) throw new Error("Seleção de serviços do Concierge inválida.");
    if (event.concierge.services.some(service => !["transport", "parking", "restaurant", "hotel"].includes(service))) throw new Error("Serviço de Concierge inválido.");
  }

  const { data: saved, error } = await supabase.from("events").insert({
    user_id: userId,
    title,
    starts_at: start.toISOString(),
    ends_at: end.toISOString(),
    location: event.location?.trim() || null,
    notes: event.notes?.trim() || null,
    event_type: eventType,
    blocks_time: blocksTime,
    category: event.category ?? "personal",
  }).select("id").single();

  if (error) throw new Error(error.message);
  if (event.concierge && saved) {
    const services = [...new Set(event.concierge.services)];
    const { error: conciergeError } = await supabase.from("event_concierge").insert({
      event_id: saved.id,
      user_id: userId,
      departure_address: event.concierge.departureAddress.slice(0, 300) || null,
      services,
    });
    if (conciergeError) {
      // Avoid leaving a seemingly successful event without its requested concierge setup.
      await supabase.from("events").update({ deleted_at: new Date().toISOString() }).eq("id", saved.id).eq("user_id", userId);
      throw new Error("Não foi possível ativar o Concierge. Verifique a configuração e tente novamente.");
    }
  }
}

export async function deleteCloudEvent(eventId: string): Promise<void> {
  const { supabase, userId } = await getAuthenticatedUser();

  const { error } = await supabase
    .from("events")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", eventId)
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
}

/** Rename an existing event without deleting or recreating it. */
export async function renameCloudEvent(eventId: string, nextTitle: string): Promise<void> {
  const { supabase, userId } = await getAuthenticatedUser();
  const title = nextTitle.trim();
  if (!title || title.length > 200 || !/[\p{L}\p{N}]/u.test(title)) {
    throw new Error("Informe um título de até 200 caracteres.");
  }
  if (!/^[0-9a-f-]{36}$/i.test(eventId)) {
    throw new Error("Identificador de compromisso inválido.");
  }
  const { data, error } = await supabase.from("events")
    .update({ title })
    .eq("id", eventId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Compromisso não encontrado ou sem permissão para editar.");
}

export async function updateCloudEventCategory(eventId: string, category: EventCategory): Promise<void> {
  if (!isEventCategory(category)) throw new Error("Categoria inválida.");
  const { supabase, userId } = await getAuthenticatedUser();
  const { data, error } = await supabase.from("events")
    .update({ category })
    .eq("id", eventId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Compromisso não encontrado ou sem permissão.");
}
