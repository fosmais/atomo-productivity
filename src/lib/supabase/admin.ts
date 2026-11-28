import "server-only";
import { createClient } from "@supabase/supabase-js";

function assertPreviewProject(supabaseUrl: string | undefined, expectedHost: string) {
  let stagingUrl: URL;
  try {
    stagingUrl = new URL(supabaseUrl || "");
  } catch {
    throw new Error("Preview MVP3 exige URL válida do Supabase de homologação.");
  }
  if (
    stagingUrl.protocol !== "https:" ||
    stagingUrl.hostname !== expectedHost ||
    stagingUrl.pathname !== "/" ||
    stagingUrl.search !== "" ||
    stagingUrl.hash !== ""
  ) {
    throw new Error("Preview MVP3 não pode usar Supabase fora do projeto de homologação autorizado.");
  }
}

export function createSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  // Preserve the tested MVP2 project pin without changing its contract.
  if (
    process.env.VERCEL_ENV === "preview" &&
    process.env.VERCEL_GIT_COMMIT_REF === "feat/mvp2-professora-journey-myra-26"
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

  // MVP3 Preview is pinned to its isolated Supabase branch project.
  if (
    process.env.VERCEL_ENV === "preview" &&
    process.env.VERCEL_GIT_COMMIT_REF === "feat/myryra-mvp3-agent-foundation"
  ) {
    assertPreviewProject(supabaseUrl, "sdwguqyjuvuamfiingsp.supabase.co");
  }

  // Explicit fail-closed switch while the dedicated staging admin credential
  // is not provisioned. Never substitute a production service-role key.
  if (process.env.SUPABASE_ADMIN_DISABLED === "true") {
    throw new Error("Credencial administrativa de homologação ainda não provisionada.");
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
