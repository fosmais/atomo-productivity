import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function previewDatabaseIsUnsafe() {
  if (process.env.VERCEL_ENV !== "preview") return false;
  return process.env.NEXT_PUBLIC_SUPABASE_URL !== "https://xanavauqzsrgvdfhcrsm.supabase.co";
}


const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Read an owned lesson transcript. Never returns another user's messages. */
export async function GET(request: Request) {
  if (previewDatabaseIsUnsafe()) return NextResponse.json({ error: "Preview bloqueado: Supabase de homologação não configurado." }, { status: 503 });
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
  const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error) return NextResponse.json({ error: "Verificação indisponível." }, { status: 503 });
  if (assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2")
    return NextResponse.json({ error: "Verificação adicional necessária." }, { status: 403 });
  const sessionId = new URL(request.url).searchParams.get("sessionId");
  if (!sessionId || !uuid.test(sessionId)) return NextResponse.json({ error: "Sessão inválida." }, { status: 400 });
  const { data: session, error: sessionError } = await supabase.from("mika_teacher_sessions")
    .select("id,journey_id,topic,level,status").eq("id", sessionId).eq("owner_id", user.id).maybeSingle();
  if (sessionError) return NextResponse.json({ error: "Histórico indisponível." }, { status: 503 });
  if (!session) return NextResponse.json({ error: "Aula não encontrada." }, { status: 404 });
  const { data, error: messagesError } = await supabase.from("mika_teacher_messages")
    .select("id,role,content,created_at").eq("session_id", sessionId).eq("owner_id", user.id)
    .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(100);
  if (messagesError) return NextResponse.json({ error: "Não foi possível carregar mensagens." }, { status: 503 });
  return NextResponse.json({ session, messages: (data ?? []).reverse() }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
