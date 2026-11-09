import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/supabase/request-client";
import { listExternalAppConnections } from "@/lib/mika/external-app-connections";

/**
 * Read-only user-scoped connection inventory.
 * A stored OAuth record is NOT proof that the token is valid or that the
 * provider has granted permission to execute actions.
 */
export async function GET(request: Request) {
  try {
    const { supabase, user, mfaRequired, assuranceUnavailable } = await authenticateRequest(request);
    if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    if (assuranceUnavailable || mfaRequired) {
      return NextResponse.json({ error: "Verificação de segurança necessária." }, { status: 403 });
    }

    // Never select encrypted credentials or accept a user ID from the client.
    // User-scoped queries are protected by RLS and explicitly filtered by identity.
    const [google, todoist] = await Promise.all([
      supabase.from("google_calendar_connections").select("user_id").eq("user_id", user.id).maybeSingle(),
      supabase.from("todoist_connections").select("user_id").eq("user_id", user.id).maybeSingle(),
    ]);
    if (google.error || todoist.error) {
      return NextResponse.json(
        { error: "Não foi possível verificar os registros de conexão." },
        { status: 503, headers: { "Cache-Control": "private, no-store" } },
      );
    }

    return NextResponse.json(
      {
        apps: listExternalAppConnections(),
        connectionVerification: "records_only",
        connectionRecords: {
          googleCalendar: google.data !== null ? "record_present_unverified" : "no_record",
          todoist: todoist.data !== null ? "record_present_unverified" : "no_record",
        },
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "Não foi possível consultar aplicativos." }, { status: 500 });
  }
}
