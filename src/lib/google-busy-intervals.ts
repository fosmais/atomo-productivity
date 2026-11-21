import type { TimeInterval } from "./availability-engine";
import { getGoogleCalendarPreferences } from "./google-calendar-preferences";
import { filterEventsBySelectedCalendars } from "./google-calendar-filter";
import { getGoogleEventInterval } from "./google-event-time";

type GoogleSchedulingEvent = {
  calendarId: string;
  start: string | null;
  end: string | null;
  calendarTimeZone?: string | null;
  status: string | null;
  transparency: string | null;
  selfResponseStatus: string | null;
};

type GoogleEventsResponse = {
  connected: boolean;
  events: GoogleSchedulingEvent[];
};

export async function getGoogleBusyIntervals(): Promise<TimeInterval[]> {
  const response = await fetch("/api/google/events", {
    cache: "no-store",
  });

  if (response.status === 409) {
    const detail: { code?: string } = await response.json().catch(() => ({}));
    if (detail.code === "GOOGLE_CALENDAR_RECONNECT_REQUIRED") {
      throw new Error("Reconecte o Google Calendar na Agenda para que a MYKA confirme seus horários livres.");
    }
  }
  if (!response.ok) {
    throw new Error("Não foi possível confirmar os horários do Google Calendar. Tente atualizar a Agenda antes de receber uma sugestão.");
  }

  const data: GoogleEventsResponse = await response.json();

  if (
    typeof data?.connected !== "boolean" ||
    !Array.isArray(data.events)
  ) {
    throw new Error("Resposta inválida do Google Calendar.");
  }

  const preferences = await getGoogleCalendarPreferences();

  if (!data.connected) {
    return [];
  }

  return filterEventsBySelectedCalendars(
    data.events,
    preferences.selectedCalendarIds
  )
    .filter(
      (event) =>
        event.status !== "cancelled" &&
        event.transparency !== "transparent" &&
        event.selfResponseStatus !== "declined"
    )
    .map((event) => getGoogleEventInterval(event))
    .filter(
      (interval): interval is TimeInterval =>
        interval !== null
    )
    .filter(
      (interval) =>
        Number.isFinite(interval.start.getTime()) &&
        Number.isFinite(interval.end.getTime()) &&
        interval.start < interval.end
    );
}
