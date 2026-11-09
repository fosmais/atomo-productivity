import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/supabase/request-client";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { listExternalAppConnections } from "@/lib/mika/external-app-connections";
import { decryptTodoistToken } from "@/lib/todoist-token-crypto";
import { decryptGoogleToken, encryptGoogleToken } from "@/lib/google-token-crypto";
import { createGoogleOAuthClient } from "@/lib/google-calendar";

/**
 * Read-only user-scoped connection inventory.
 * A stored OAuth record is NOT proof that the token is valid or that the
 * provider has granted permission to execute actions.
 */
export async function GET(request: Request) {
  try {
    const { user, mfaRequired, assuranceUnavailable } = await authenticateRequest(request);
    if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    if (assuranceUnavailable || mfaRequired) {
      return NextResponse.json({ error: "Verificação de segurança necessária." }, { status: 403 });
    }

    // These connection tables have RLS enabled without SELECT policies.
    // Use the server-only admin client, always filtering by the verified user ID.
    // Never select encrypted credentials or accept a user ID from the client.
    const admin = createSupabaseAdmin();
    const [google, todoist] = await Promise.all([
      admin.from("google_calendar_connections").select("encrypted_access_token, encrypted_refresh_token, token_expires_at").eq("user_id", user.id).maybeSingle(),
      admin.from("todoist_connections").select("user_id, encrypted_access_token").eq("user_id", user.id).maybeSingle(),
    ]);
    if (google.error || todoist.error) {
      return NextResponse.json(
        { error: "Não foi possível verificar os registros de conexão." },
        { status: 503, headers: { "Cache-Control": "private, no-store" } },
      );
    }

    // Verify calendar-list read permission without retrieving any events or calendars.
    // Refresh an expired access token server-side and persist the replacement.
    let googleStatus: "no_record" | "verified_readonly" | "reconnect_required" | "verification_unavailable" = "no_record";
    if (google.data) {
      try {
        const oauth = createGoogleOAuthClient();
        oauth.setCredentials({
          access_token: decryptGoogleToken(google.data.encrypted_access_token),
          refresh_token: google.data.encrypted_refresh_token
            ? decryptGoogleToken(google.data.encrypted_refresh_token) : undefined,
          expiry_date: google.data.token_expires_at
            ? new Date(google.data.token_expires_at).getTime() : undefined,
        });
        // Google OAuth client refreshes expired tokens automatically when possible.
        const token = await oauth.getAccessToken();
        if (!token.token) {
          googleStatus = "reconnect_required";
        } else {
          const current = oauth.credentials;
          if (current.access_token && current.access_token !== decryptGoogleToken(google.data.encrypted_access_token)) {
            const { error: saveError } = await admin.from("google_calendar_connections").update({
              encrypted_access_token: encryptGoogleToken(current.access_token),
              ...(current.refresh_token ? { encrypted_refresh_token: encryptGoogleToken(current.refresh_token) } : {}),
              ...(current.expiry_date ? { token_expires_at: new Date(current.expiry_date).toISOString() } : {}),
              updated_at: new Date().toISOString(),
            }).eq("user_id", user.id);
            if (saveError) throw new Error("Token refresh persistence failed");
          }
          const response = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=1&fields=kind", {
            headers: { Authorization: `Bearer ${token.token}` },
            cache: "no-store",
            signal: AbortSignal.timeout(8000),
          });
          googleStatus = response.ok ? "verified_readonly"
            : response.status === 401 || response.status === 403 ? "reconnect_required"
            : "verification_unavailable";
        }
      } catch {
        googleStatus = "verification_unavailable";
      }
    }

    // Verify Todoist read access with the provider; never return token or task data.
    let todoistStatus: "no_record" | "verified_readonly" | "reconnect_required" | "verification_unavailable" = "no_record";
    if (todoist.data) {
      try {
        const token = decryptTodoistToken(todoist.data.encrypted_access_token);
        const response = await fetch("https://api.todoist.com/api/v1/tasks?limit=1", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
          signal: AbortSignal.timeout(8000),
        });
        todoistStatus = response.ok ? "verified_readonly"
          : response.status === 401 || response.status === 403 ? "reconnect_required"
          : "verification_unavailable";
      } catch {
        todoistStatus = "verification_unavailable";
      }
    }

    return NextResponse.json(
      {
        apps: listExternalAppConnections(),
        connectionVerification: "provider_checked",
        connectionRecords: {
          googleCalendar: googleStatus,
          todoist: todoistStatus,
        },
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "Não foi possível consultar aplicativos." }, { status: 500 });
  }
}
