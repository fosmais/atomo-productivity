import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function previewDatabaseIsUnsafe() {
  if (process.env.VERCEL_ENV !== "preview") return false;
  if (process.env.MIKA_TEACHER_HOMOLOGATION_READY !== "true") return true;
  return process.env.NEXT_PUBLIC_SUPABASE_URL !== "https://xanavauqzsrgvdfhcrsm.supabase.co";
}


const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Delete an entire owned lesson and its transcript, on explicit user request. */
export async function DELETE(request: Request) {
  if (previewDatabaseIsUnsafe()) return NextResponse.json({ error: "Preview bloqueado: Supabase de homologação não configurado." }, { status: 503 });
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
  const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error) return NextResponse.json({ error: "Verificação indisponível." }, { status: 503 });
  if (assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2")
    return NextResponse.json({ error: "Verificação adicional necessária." }, { status: 403 });
  const sessionId = new URL(request.url).searchParams.get("sessionId");
  if (!sessionId || !uuid.test(sessionId)) return NextResponse.json({ error: "Aula inválida." }, { status: 400 });
  const { data, error } = await supabase.from("mika_teacher_sessions")
    .delete().eq("id", sessionId).eq("owner_id", user.id).select("id").maybeSingle();
  if (error) return NextResponse.json({ error: "Não foi possível excluir a aula." }, { status: 503 });
  if (!data) return NextResponse.json({ error: "Aula não encontrada." }, { status: 404 });
  return NextResponse.json({ deleted: true }, { headers: { "Cache-Control": "private, no-store" } });
}
