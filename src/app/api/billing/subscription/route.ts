import { NextResponse, connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const headers = { "Cache-Control": "private, no-store" };
/** Read-only subscription lifecycle. Never accepts a user ID from the browser. */
export async function GET() {
  await connection();
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Autenticação necessária." }, { status: 401, headers });
  const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error) return NextResponse.json({ error: "Verificação indisponível." }, { status: 503, headers });
  if (assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2") {
    return NextResponse.json({ error: "Segundo fator obrigatório.", code: "MFA_REQUIRED" }, { status: 403, headers });
  }
  if (process.env.BILLING_ENTITLEMENTS_ENABLED !== "true") {
    return NextResponse.json({ provider: "asaas", checkoutEnabled: false, subscription: null }, { headers });
  }
  try {
    const { data, error: dbError } = await createSupabaseAdmin()
      .from("billing_subscriptions")
      .select("plan_id,status,provider,current_period_end,cancel_at_period_end,updated_at")
      .eq("user_id", user.id)
      .maybeSingle();
    if (dbError) throw dbError;
    return NextResponse.json({
      provider: "asaas",
      checkoutEnabled: false,
      subscription: data ? {
        planId: data.plan_id,
        status: data.status,
        provider: data.provider,
        currentPeriodEnd: data.current_period_end,
        cancelAtPeriodEnd: data.cancel_at_period_end,
        updatedAt: data.updated_at,
      } : null,
    }, { headers });
  } catch {
    return NextResponse.json({ error: "Não foi possível consultar a assinatura." }, { status: 503, headers });
  }
}
