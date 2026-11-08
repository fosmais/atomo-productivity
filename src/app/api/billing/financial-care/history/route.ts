import { NextResponse, connection } from "next/server";
import { createClient } from "@/lib/supabase/server";

const headers = { "Cache-Control": "private, no-store" };

/**
 * Read-only financial-care protocol history. Uses user-scoped RLS.
 * No service-role credentials, no provider mutations.
 */
export async function GET(request: Request) {
  await connection();
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Autenticação necessária." }, { status: 401, headers });
  const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error) return NextResponse.json({ error: "Verificação indisponível." }, { status: 503, headers });
  if (assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2") {
    return NextResponse.json({ error: "Segundo fator obrigatório.", code: "MFA_REQUIRED" }, { status: 403, headers });
  }
  if (process.env.MIKA_FINANCIAL_CARE_HISTORY_ENABLED !== "true") {
    return NextResponse.json({ error: "Histórico ainda não disponível." }, { status: 503, headers });
  }
  const url = new URL(request.url);
  const protocol = url.searchParams.get("protocol");
  if (protocol && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(protocol)) {
    return NextResponse.json({ error: "Protocolo inválido." }, { status: 400, headers });
  }
  let query = supabase.from("billing_financial_care_requests")
    .select("id,action,target_plan,status,confirmed_at,effective_at,created_at,updated_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);
  if (protocol) query = query.eq("id", protocol);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Histórico indisponível." }, { status: 503, headers });
  return NextResponse.json({ requests: data ?? [], hasMore: !protocol && (data?.length ?? 0) === 20 }, { headers });
}
