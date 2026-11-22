import "server-only";
import { createClient } from "@supabase/supabase-js";

export function createSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  // A selective release must NEVER access a non-staging project, even if
  // accidentally promoted to a production deployment.
  const branch = process.env.VERCEL_GIT_COMMIT_REF || "";
  const isSelectiveRelease = branch === "release/mika-concierge-v2-db-gate-20261121";
  const isMvp2Preview = branch === "feat/mvp2-professora-journey-myra-26" &&
    process.env.VERCEL_ENV !== "production";

  if (isSelectiveRelease || isMvp2Preview) {
    let stagingUrl: URL;
    try {
      stagingUrl = new URL(supabaseUrl || "");
    } catch {
      throw new Error("MIKA staging exige URL válida do Supabase de homologação.");
    }
    if (
      stagingUrl.protocol !== "https:" ||
      stagingUrl.hostname !== "xanavauqzsrgvdfhcrsm.supabase.co" ||
      stagingUrl.pathname !== "/" ||
      stagingUrl.search !== "" ||
      stagingUrl.hash !== ""
    ) {
      throw new Error("MIKA staging não pode usar Supabase fora da homologação.");
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