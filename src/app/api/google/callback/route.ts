import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { google } from "googleapis";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createGoogleOAuthClient } from "@/lib/google-calendar";
import { encryptGoogleToken } from "@/lib/google-token-crypto";



function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function GET(request: NextRequest) {
  const redirect = (status: string) => {
    const response = NextResponse.redirect(
      new URL(`/dashboard?google_calendar=${status}#vyra-settings`, request.url)
    );
    response.cookies.delete({
      name: "vyra_google_oauth_state",
      path: "/api/google",
    });
    return response;
  };

  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  const returnedState = params.get("state");
  const oauthError = params.get("error");
  const storedState = request.cookies.get("vyra_google_oauth_state")?.value;

  if (oauthError) return redirect("denied");
  if (!code || !returnedState || !storedState) {
    return redirect("invalid_state");
  }

  let expectedState: { state: string; userId: string };

  try {
    expectedState = JSON.parse(storedState);
    if (
      typeof expectedState.state !== "string" ||
      typeof expectedState.userId !== "string" ||
      !safeEqual(returnedState, expectedState.state)
    ) {
      return redirect("invalid_state");
    }
  } catch {
    return redirect("invalid_state");
  }

  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user || user.id !== expectedState.userId) {
    return redirect("unauthorized");
  }

  const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error) return redirect("auth_error");
  if (assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2") {
    return redirect("mfa_required");
  }

  try {
    const oauth = createGoogleOAuthClient();
    const { tokens } = await oauth.getToken(code);

    if (!tokens.access_token) {
      return redirect("missing_tokens");
    }

    oauth.setCredentials(tokens);

    const calendar = google.calendar({ version: "v3", auth: oauth });
    const { data: calendarInfo } = await calendar.calendarList.get({
      calendarId: "primary",
    });

    const googleAccountId = calendarInfo.id ?? null;

    const admin = createSupabaseAdmin();
    // Google may omit refresh_token on repeat consent. Only reuse a saved
    // token when the Google account is the same; never cross account boundaries.
    let encryptedRefreshToken = tokens.refresh_token
      ? encryptGoogleToken(tokens.refresh_token)
      : null;
    if (!encryptedRefreshToken) {
      const { data: previous, error: previousError } = await admin
        .from("google_calendar_connections")
        .select("google_account_id, encrypted_refresh_token")
        .eq("user_id", user.id)
        .maybeSingle();
      if (previousError) return redirect("save_error");
      if (previous?.google_account_id && previous.google_account_id === googleAccountId) {
        encryptedRefreshToken = previous.encrypted_refresh_token ?? null;
      }
    }
    if (!encryptedRefreshToken) return redirect("missing_tokens");

    const { error: saveError } = await admin
      .from("google_calendar_connections")
      .upsert({
        user_id: user.id,
        google_account_id: googleAccountId,
        encrypted_access_token: encryptGoogleToken(tokens.access_token),
        encrypted_refresh_token: encryptedRefreshToken,
        token_expires_at: tokens.expiry_date
          ? new Date(tokens.expiry_date).toISOString()
          : null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" })
      .select("user_id")
      .single();

    if (saveError) {
      console.error("VYRA Google Calendar: falha ao salvar conexão.", {
        code: saveError.code,
      });
      return redirect("save_error");
    }

    return redirect("connected");
  } catch (error) {
    console.error("VYRA Google Calendar: callback falhou.", {
      message: error instanceof Error ? error.message : "Erro desconhecido",
      type: error instanceof Error ? error.name : "unknown",
    });
    return redirect("connection_error");
  }
}