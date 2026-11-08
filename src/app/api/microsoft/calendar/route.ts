import { NextResponse, connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { decryptMicrosoftToken, encryptMicrosoftToken } from "@/lib/microsoft-token-crypto";

const headers = { "Cache-Control": "no-store" };
type Connection = {
  encrypted_access_token: string;
  encrypted_refresh_token: string | null;
  token_expires_at: string | null;
};

export async function GET() {
  await connection();
  if (process.env.MICROSOFT_INTEGRATION_ENABLED !== "true")
    return NextResponse.json({ error: "Integração Microsoft em homologação." }, { status: 503, headers });
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Não autenticado." }, { status: 401, headers });
  const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error || (assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2"))
    return NextResponse.json({ error: "Verificação de sessão necessária." }, { status: 403, headers });
  const admin = createSupabaseAdmin();
  const { data, error: lookupError } = await admin.from("microsoft_connections")
    .select("encrypted_access_token,encrypted_refresh_token,token_expires_at")
    .eq("user_id", user.id).maybeSingle();
  if (lookupError) return NextResponse.json({ error: "Falha ao consultar conexão." }, { status: 503, headers });
  if (!data) return NextResponse.json({ connected: false, events: [] }, { headers });
  try {
    const saved = data as Connection;
    let accessToken = decryptMicrosoftToken(saved.encrypted_access_token);
    const expiresAt = saved.token_expires_at ? Date.parse(saved.token_expires_at) : 0;
    if (!Number.isFinite(expiresAt) || expiresAt < Date.now() + 120000) {
      if (!saved.encrypted_refresh_token) return NextResponse.json({ error: "Reconecte sua conta Microsoft.", code: "MICROSOFT_RECONNECT_REQUIRED" }, { status: 409, headers });
      const clientId = process.env.MICROSOFT_CLIENT_ID;
      const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
      if (!clientId || !clientSecret) return NextResponse.json({ error: "Microsoft não configurado." }, { status: 503, headers });
      const response = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId, client_secret: clientSecret, grant_type: "refresh_token",
          refresh_token: decryptMicrosoftToken(saved.encrypted_refresh_token),
          scope: "openid offline_access Calendars.Read",
        }),
        cache: "no-store", signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) {
        if (response.status === 400 || response.status === 401)
          return NextResponse.json({ error: "Reconecte sua conta Microsoft.", code: "MICROSOFT_RECONNECT_REQUIRED" }, { status: 409, headers });
        throw new Error("Token refresh failed");
      }
      const payload: unknown = await response.json();
      if (!payload || typeof payload !== "object") throw new Error("Invalid refresh response");
      const tokens = payload as Record<string, unknown>;
      if (typeof tokens.access_token !== "string" || !tokens.access_token) throw new Error("Missing token");
      accessToken = tokens.access_token;
      const expires = typeof tokens.expires_in === "number" ? Math.max(60, Math.min(tokens.expires_in, 86400)) : 3600;
      const update: Record<string, string> = {
        encrypted_access_token: encryptMicrosoftToken(accessToken),
        token_expires_at: new Date(Date.now() + expires * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      };
      if (typeof tokens.refresh_token === "string" && tokens.refresh_token)
        update.encrypted_refresh_token = encryptMicrosoftToken(tokens.refresh_token);
      const { error: updateError } = await admin.from("microsoft_connections").update(update).eq("user_id", user.id);
      if (updateError) throw new Error("Failed to save refreshed token");
    }
    const start = new Date();
    const end = new Date(start.getTime() + 30 * 86400000);
    const endpoint = new URL("https://graph.microsoft.com/v1.0/me/calendarView");
    endpoint.searchParams.set("startDateTime", start.toISOString());
    endpoint.searchParams.set("endDateTime", end.toISOString());
    endpoint.searchParams.set("$top", "100");
    endpoint.searchParams.set("$select", "id,subject,start,end,isCancelled,webLink");
    const events: Array<{ id: string; title: string; start: string; end: string; webLink: string | null }> = [];
    let next: string | null = endpoint.href;
    const seen = new Set<string>();
    for (let page = 0; next && page < 5; page++) {
      if (seen.has(next)) throw new Error("Repeated Graph page");
      seen.add(next);
      const url: URL = new URL(next);
      if (url.protocol !== "https:" || url.host !== "graph.microsoft.com" || !url.pathname.startsWith("/v1.0/me/calendarView"))
        throw new Error("Invalid Graph pagination URL");
      const response: Response = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}`, Prefer: 'outlook.timezone="UTC"' },
        cache: "no-store", signal: AbortSignal.timeout(10000),
      });
      if (response.status === 401 || response.status === 403)
        return NextResponse.json({ error: "Reconecte sua conta Microsoft.", code: "MICROSOFT_RECONNECT_REQUIRED" }, { status: 409, headers });
      if (!response.ok) throw new Error("Graph unavailable");
      const payload: unknown = await response.json();
      if (!payload || typeof payload !== "object") throw new Error("Invalid Graph response");
      const pageData = payload as Record<string, unknown>;
      const rows = Array.isArray(pageData.value) ? pageData.value : [];
      for (const item of rows) {
        if (!item || typeof item !== "object") continue;
        const row = item as Record<string, unknown>;
        const startDate = row.start && typeof row.start === "object" ? (row.start as Record<string, unknown>).dateTime : null;
        const endDate = row.end && typeof row.end === "object" ? (row.end as Record<string, unknown>).dateTime : null;
        if (typeof row.id !== "string" || typeof startDate !== "string" || typeof endDate !== "string" || row.isCancelled === true) continue;
        events.push({
          id: row.id, title: typeof row.subject === "string" ? row.subject.slice(0, 200) : "Compromisso",
          start: startDate, end: endDate,
          webLink: typeof row.webLink === "string" && row.webLink.startsWith("https://") ? row.webLink : null,
        });
        if (events.length >= 300) break;
      }
      if (events.length >= 300) break;
      next = typeof pageData["@odata.nextLink"] === "string" ? pageData["@odata.nextLink"] : null;
    }
    return NextResponse.json({ connected: true, events, rangeDays: 30, truncated: events.length >= 300 }, { headers });
  } catch {
    return NextResponse.json({ error: "Não foi possível consultar o calendário Microsoft." }, { status: 502, headers });
  }
}
