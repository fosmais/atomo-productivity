import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { validateFinancialCareRequest } from "@/lib/billing/financial-care";

const headers = { "Cache-Control": "private, no-store" };

/**
 * Sandbox-only intake. Persists an intent for manual review, NOT a financial mutation.
 * Disabled by default until the reviewed schema and atomic RPC are installed.
 */
export async function POST(request: Request) {
  if (process.env.ASAAS_ENVIRONMENT !== "sandbox" ||
      process.env.MIKA_FINANCIAL_CARE_INTAKE_ENABLED !== "true") {
    return NextResponse.json({ error: "Solicitações financeiras ainda não disponíveis." }, { status: 503, headers });
  }
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Autenticação necessária." }, { status: 401, headers });
  const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error) return NextResponse.json({ error: "Verificação de sessão indisponível." }, { status: 503, headers });
  if (assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2") {
    return NextResponse.json({ error: "Segundo fator obrigatório.", code: "MFA_REQUIRED" }, { status: 403, headers });
  }
  const key = request.headers.get("idempotency-key");
  if (!key || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key)) {
    return NextResponse.json({ error: "Idempotency-Key UUID obrigatório." }, { status: 400, headers });
  }
  let body: unknown;
  try {
    const raw = await request.text();
    if (raw.length > 8192) throw new Error("large");
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Solicitação inválida." }, { status: 400, headers });
  }
  const parsed = validateFinancialCareRequest(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.code }, { status: 400, headers });
  if (parsed.action === "request_refund") {
    return NextResponse.json({ error: "Validação de propriedade do pagamento pendente.", code: "PAYMENT_OWNERSHIP_CHECK_PENDING" }, { status: 501, headers });
  }
  const admin = createSupabaseAdmin();
  const { data: sub, error: subError } = await admin.from("billing_subscriptions")
    .select("id,plan_id,status,provider,current_period_end,cancel_at_period_end")
    .eq("user_id", user.id).maybeSingle();
  if (subError) return NextResponse.json({ error: "Consulta indisponível." }, { status: 503, headers });
  if (!sub || sub.provider !== "asaas" || !["active","trialing"].includes(sub.status)) {
    return NextResponse.json({ error: "Assinatura Asaas elegível não encontrada." }, { status: 409, headers });
  }
  if (parsed.action === "cancel_renewal" && sub.cancel_at_period_end) {
    return NextResponse.json({ error: "Renovação já cancelada." }, { status: 409, headers });
  }
  if (parsed.action === "downgrade") {
    const rank: Record<string,number> = { free: 0, pro: 1, premium: 2 };
    if (!parsed.targetPlan || rank[parsed.targetPlan] >= (rank[sub.plan_id] ?? -1)) {
      return NextResponse.json({ error: "Plano de destino inválido." }, { status: 409, headers });
    }
  }
  // Atomic insert + audit + replay check is performed by a restricted service-role RPC.
  const { data, error } = await admin.rpc("billing_financial_care_intake", {
    p_user_id: user.id,
    p_subscription_id: sub.id,
    p_action: parsed.action,
    p_target_plan: parsed.action === "downgrade" ? parsed.targetPlan : null,
    p_idempotency_key: key,
    p_effective_at: sub.current_period_end,
  });
  if (error || !data) return NextResponse.json({ error: "Registro indisponível; nenhuma operação financeira realizada." }, { status: 503, headers });
  return NextResponse.json({
    protocol: data,
    status: "pending_review",
    executed: false,
    message: "Solicitação registrada para análise. Nenhuma alteração de cobrança foi executada.",
  }, { status: 202, headers });
}
