import "server-only";
import { createClient } from "@supabase/supabase-js";

export function createSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  // Fail closed for the MVP2 homologation branch: never run privileged writes\n  // against the production database, even if Preview variables are misconfigured.\n  if (\n    process.env.VERCEL_ENV === "preview" &&\n    process.env.VERCEL_GIT_COMMIT_REF === "feat/mvp2-professora-journey-myra-26" &&\n    new URL(supabaseUrl || "https://invalid.local").hostname === "qothgddrvrpeqsprslqk.supabase.co"\n  ) {\n    throw new Error("Preview MVP2 não pode usar Supabase de produção.");\n  }\n\n  if (!supabaseUrl || !secretKey) {
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