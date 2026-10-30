import { NextResponse } from "next/server";
import { google } from "googleapis";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createGoogleOAuthClient } from "@/lib/google-calendar";
import { decryptGoogleToken, encryptGoogleToken } from "@/lib/google-token-crypto";

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: "Não autenticado." },
      { status: 401 }
    );
  }

  const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error) return NextResponse.json({ error: "Verificação de sessão indisponível." }, { status: 503 });
  if (assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2") {
    return NextResponse.json({ error: "Segundo fator obrigatório.", code: "MFA_REQUIRED" }, { status: 403 });
  }

  try {
    const admin = createSupabaseAdmin();

    const { data: connection, error: connectionError } = await admin
      .from("google_calendar_connections")
      .select(
        "encrypted_access_token, encrypted_refresh_token, token_expires_at"
      )
      .eq("user_id", user.id)
      .maybeSingle();

    if (connectionError) {
      return NextResponse.json(
        { error: "Falha ao consultar a conexão." },
        { status: 500 }
      );
    }

    if (!connection) {
      return NextResponse.json(
        { connected: false, events: [] },
        { status: 200 }
      );
    }

    let tokenSave: Promise<void> = Promise.resolve();
    const oauth = createGoogleOAuthClient();

    oauth.setCredentials({
      access_token: decryptGoogleToken(
        connection.encrypted_access_token
      ),
      refresh_token: connection.encrypted_refresh_token
        ? decryptGoogleToken(connection.encrypted_refresh_token)
        : undefined,
      expiry_date: connection.token_expires_at
        ? new Date(connection.token_expires_at).getTime()
        : undefined,
    });

    // Persistir os tokens renovados antes de continuar.
    // Nunca registrar os valores dos tokens nos logs.
    oauth.on("tokens", (tokens) => {
      const update: Record<string, string> = {
        updated_at: new Date().toISOString(),
      };

      if (tokens.access_token) {
        update.encrypted_access_token = encryptGoogleToken(
          tokens.access_token
        );
      }

      if (tokens.refresh_token) {
        update.encrypted_refresh_token = encryptGoogleToken(
          tokens.refresh_token
        );
      }

      if (tokens.expiry_date) {
        update.token_expires_at = new Date(
          tokens.expiry_date
        ).toISOString();
      }

      tokenSave = tokenSave.then(async () => {
        const { error } = await admin
          .from("google_calendar_connections")
          .update(update)
          .eq("user_id", user.id);

        if (error) {
          throw new Error("Falha ao persistir tokens renovados.");
        }
      });
    });
    const calendar = google.calendar({
      version: "v3",
      auth: oauth,
    });

    const now = new Date();
    const until = new Date(now);
    until.setDate(until.getDate() + 30);

    // Listar calendarios acessiveis, incluindo os secundarios.
    const calendarEntries: import("googleapis").calendar_v3.Schema$CalendarListEntry[] = [];

    let calendarPageToken: string | undefined;
    const seenCalendarTokens = new Set<string>();

    do {
      const response = await calendar.calendarList.list({
        maxResults: 100,
        pageToken: calendarPageToken,
      });

      calendarEntries.push(...(response.data.items ?? []));

      const nextToken = response.data.nextPageToken ?? undefined;

      if (nextToken && seenCalendarTokens.has(nextToken)) {
        throw new Error("Paginacao da lista de calendarios inconsistente.");
      }

      if (nextToken) {
        seenCalendarTokens.add(nextToken);
      }

      calendarPageToken = nextToken;
    } while (calendarPageToken);

    const { data: calendarPreference, error: preferenceError } =
      await supabase
        .from("google_calendar_preferences")
        .select("selected_calendar_ids")
        .eq("user_id", user.id)
        .maybeSingle();

    if (preferenceError) {
      throw new Error("Falha ao consultar preferências de calendários.");
    }

    const explicitlySelected = new Set<string>(
      calendarPreference?.selected_calendar_ids ?? []
    );

    const selectedCalendars = calendarEntries.filter(
      (entry) =>
        Boolean(entry.id) &&
        (
          entry.selected !== false ||
          explicitlySelected.has(entry.id!)
        )
    );

    const allEvents: Array<{
      calendarId: string;
      calendarName: string;
      calendarTimeZone: string | null;
      event: import("googleapis").calendar_v3.Schema$Event;
    }> = [];

    for (const entry of selectedCalendars) {
      const calendarId = entry.id!;
      const calendarName = entry.summary ?? "Google Calendar";
      const calendarTimeZone = entry.timeZone ?? null;

      let pageToken: string | undefined;
      const seenPageTokens = new Set<string>();

      do {
        const response = await calendar.events.list({
          calendarId,
          timeMin: now.toISOString(),
          timeMax: until.toISOString(),
          singleEvents: true,
          orderBy: "startTime",
          maxResults: 100,
          pageToken,
        });

        for (const event of response.data.items ?? []) {
          allEvents.push({
            calendarId,
            calendarName,
            calendarTimeZone,
            event,
          });
        }

        const nextToken = response.data.nextPageToken ?? undefined;

        if (nextToken && seenPageTokens.has(nextToken)) {
          throw new Error("Paginacao de eventos inconsistente.");
        }

        if (nextToken) {
          seenPageTokens.add(nextToken);
        }

        pageToken = nextToken;
      } while (pageToken);
    }

    await tokenSave;

    const events = allEvents.map(({ calendarId, calendarName, calendarTimeZone, event }) => ({
      id: `${calendarId}:${event.id ?? ""}`,
      calendarId,
      calendarName,
      calendarTimeZone,
      title: event.summary ?? "Sem título",
      description: event.description ?? null,
      start: event.start?.dateTime ?? event.start?.date ?? null,
      end: event.end?.dateTime ?? event.end?.date ?? null,
      location: event.location ?? null,
      status: event.status ?? null,
      transparency: event.transparency ?? null,
      selfResponseStatus: event.attendees?.find(
        (attendee) => attendee.self
      )?.responseStatus ?? null,
      htmlLink: event.htmlLink ?? null,
    }));

    events.sort((a, b) =>
      (a.start ?? "").localeCompare(b.start ?? "")
    );
    return NextResponse.json({
      connected: true,
      calendars: calendarEntries
        .filter((entry) => Boolean(entry.id))
        .map((entry) => ({
          id: entry.id!,
          name: entry.summary ?? "Google Calendar",
          primary: entry.primary === true,
          googleSelected: entry.selected !== false,
          timeZone: entry.timeZone ?? null,
        })),
      events,
      count: events.length,
    });
  } catch (error) {
    console.error("VYRA Google Events: falha na consulta.", {
      type: error instanceof Error ? error.name : "unknown",
    });

    return NextResponse.json(
      { error: "Não foi possível consultar o Google Calendar." },
      { status: 502 }
    );
  }
}