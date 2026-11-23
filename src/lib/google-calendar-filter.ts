export type CalendarEventReference = {
  calendarId: string;
};

export function filterEventsBySelectedCalendars<
  T extends CalendarEventReference
>(
  events: T[],
  selectedCalendarIds: string[] | null
): T[] {
  if (selectedCalendarIds === null) {
    return events;
  }

  const selected = new Set(selectedCalendarIds);

  return events.filter((event) =>
    selected.has(event.calendarId)
  );
}
