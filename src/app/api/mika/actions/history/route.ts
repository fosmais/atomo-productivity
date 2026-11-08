import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkConciergeRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

// Read-only, authenticated history. RLS also limits rows to the owner.
export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error) {
    return NextResponse.json({ error: "Sessão indisponível." }, { status: 503 });
  }
  if (assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2") {
    return NextResponse.json({ error: "Segundo fator obrigatório.", code: "MFA_REQUIRED" }, { status: 403 });
  }
  try {
    const limit = await checkConciergeRateLimit(user.id);
    if (!limit.allowed) return NextResponse.json({ error: "Limite de requisições." }, { status: 429 });
  } catch {
    return NextResponse.json({ error: "Serviço indisponível." }, { status: 503 });
  }

  const { data, error } = await supabase
    .from("mika_action_proposals")
    .select("id,action_type,payload,status,created_at,expires_at,approved_at,executed_at,result")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) {
    console.error("MIKA history unavailable", { code: error.code });
    return NextResponse.json({ error: "Histórico indisponível." },
      { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json({ proposals: data ?? [], executed: false },
    { headers: { "Cache-Control": "no-store" } });
}
