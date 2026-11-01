import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient as createCookieClient } from "@/lib/supabase/server";

/**
 * Browser requests retain cookie authentication.
 * Native requests may supply an explicit Supabase access token.
 * Never use a service-role key for user-scoped queries.
 */
export async function createRequestClient(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization) return createCookieClient();
  if (!/^Bearer [A-Za-z0-9._~-]+$/.test(authorization)) {
    throw new Error("Invalid Authorization header");
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase não configurado.");
  const token = authorization.slice(7);
  const client = createSupabaseClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  // Authentication failures are handled by authenticateRequest as HTTP 401.
  // Do not throw here: an expired native token must not become HTTP 500.
  return client;
}

/**
 * Authenticates native requests using a server-verified access token.
 * AAL is read only from cryptographically verified JWT claims.
 * Cookie requests retain the existing Supabase SSR assurance checks.
 */
export async function authenticateRequest(request: Request) {
  const supabase = await createRequestClient(request);
  const bearer = request.headers.get("authorization");
  if (bearer) {
    const token = bearer.slice(7);
    const { data: identity, error: identityError } = await supabase.auth.getUser(token);
    if (identityError || !identity.user) return { supabase, user: null, mfaRequired: false, assuranceUnavailable: false };
    const { data: verified, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !verified?.claims || verified.claims.sub !== identity.user.id) {
      return { supabase, user: null, mfaRequired: false, assuranceUnavailable: true };
    }
    // Native access is fail-closed until the session is at AAL2.
    return { supabase, user: identity.user, mfaRequired: verified.claims.aal !== "aal2", assuranceUnavailable: false };
  }
  const { data: identity, error: identityError } = await supabase.auth.getUser();
  if (identityError || !identity.user) return { supabase, user: null, mfaRequired: false, assuranceUnavailable: false };
  const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  return {
    supabase,
    user: identity.user,
    mfaRequired: !assurance.error && assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2",
    assuranceUnavailable: Boolean(assurance.error),
  };
}
