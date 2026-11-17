import "server-only";
import { createClient } from "@supabase/supabase-js";

export function createSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  // Fail closed for the MVP2 homologation branch: never run privileged writes
  // against the production database, even if Preview variables are misconfigured.
  if (
    process.env.VERCEL_ENV === "preview" &&
    process.env.VERCEL_GIT_COMMIT_REF === "feat/mvp2-professora-journey-myra-26" &&
    new URL(supabaseUrl || "https://invalid.local").hostname === "qothgddrvrpeqsprslqk.supabase.co"
  ) {
    throw new Error("Preview MVP2 não pode usar Supabase de produção.");
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