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
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) throw new Error("Invalid bearer token");
  return client;
}
