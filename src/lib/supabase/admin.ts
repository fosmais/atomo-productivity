import "server-only";
import { createClient } from "@supabase/supabase-js";

export function createSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  // Preview environments are pinned to their dedicated Supabase projects.
  // This check runs before creating any privileged client, so a Preview can
  // never silently inherit or be pointed at the production database.
  const previewProjectByBranch: Record<string, string> = {
    "feat/mvp2-professora-journey-myra-26": "xanavauqzsrgvdfhcrsm.supabase.co",
    "feat/myryra-mvp3-agent-foundation": "woqpzvqfaeqteiqpsaqi.supabase.co",
  };
  const branch = process.env.VERCEL_GIT_COMMIT_REF;
  const expectedPreviewHost = branch ? previewProjectByBranch[branch] : undefined;

  if (process.env.VERCEL_ENV === "preview" && expectedPreviewHost) {
    let stagingUrl: URL;
    try {
      stagingUrl = new URL(supabaseUrl || "");
    } catch {
      throw new Error("Preview exige URL válida do Supabase de homologação.");
    }
    if (
      stagingUrl.protocol !== "https:" ||
      stagingUrl.hostname !== expectedPreviewHost ||
      stagingUrl.pathname !== "/" ||
      stagingUrl.search !== "" ||
      stagingUrl.hash !== ""
    ) {
      throw new Error("Preview não pode usar Supabase fora do projeto de homologação autorizado para esta branch.");
    }
  }

  if (!supabaseUrl || !secretKey) {
    throw new Error("Credenciais administrativas do Supabase não configuradas.");
  }
  if (secretKey === "DISABLED_UNTIL_ISOLATED_STAGING_SECRET_IS_PROVISIONED") {
    throw new Error("Credencial administrativa de homologação ainda não provisionada.");
  }

  return createClient(supabaseUrl, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}
