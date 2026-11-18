import "server-only";
import { createClient } from "@supabase/supabase-js";

export function createSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  // The MVP2 preview must target only its dedicated staging project.
  // Reject production, other projects and malformed URLs before admin access.
  if (
    process.env.VERCEL_ENV === "preview" &&
    (process.env.VERCEL_GIT_COMMIT_REF === "feat/mvp2-professora-journey-myra-26" ||
      process.env.VERCEL_GIT_COMMIT_REF === "fix/mvp2-journey-owner-update-56")
  ) {
    let stagingUrl: URL;
    try {
      stagingUrl = new URL(supabaseUrl || "");
    } catch {
      throw new Error("Preview MVP2 exige URL válida do Supabase de homologação.");
    }
    if (
      stagingUrl.protocol !== "https:" ||
      stagingUrl.hostname !== "xanavauqzsrgvdfhcrsm.supabase.co"
    ) {
      throw new Error("Preview MVP2 não pode usar Supabase fora da homologação.");
    }
  }

  if (!supabaseUrl || !secretKey) {
    throw new Error("Credenciais administrativas do Supabase não configuradas.");
  }

  return createClient(supabaseUrl, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}