import { NextResponse, connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  await connection();
  if (process.env.MICROSOFT_INTEGRATION_ENABLED !== "true")
    return NextResponse.json({ error: "Integração Microsoft indisponível." }, { status: 503 });
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin)
    return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error || (assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2"))
    return NextResponse.json({ error: "Verificação de sessão necessária." }, { status: 403 });
  const admin = createSupabaseAdmin();
  const { error: deleteError } = await admin.from("microsoft_connections").delete().eq("user_id", user.id);
  if (deleteError) return NextResponse.json({ error: "Falha ao desconectar Microsoft." }, { status: 503 });
  return NextResponse.json({ disconnected: true }, { headers: { "Cache-Control": "no-store" } });
}
