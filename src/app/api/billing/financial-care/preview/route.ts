import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { validateFinancialCareRequest } from "@/lib/billing/financial-care";

const headers = { "Cache-Control": "private, no-store" };

/**
 * Authenticated preview ONLY. Does not create requests, contact Asaas,
 * change entitlements, cancel subscriptions, or issue refunds.
 */
export async function POST(request: Request) {
  if (process.env.ASAAS_ENVIRONMENT !== "sandbox") {
    return NextResponse.json({ error: "Prévia disponível apenas no Sandbox." }, { status: 503, headers });
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Autenticação necessária." }, { status: 401, headers });

  const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error) return NextResponse.json({ error: "Verificação de sessão indisponível." }, { status: 503, headers });
  if (assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2") {
    return NextResponse.json({ error: "Segundo fator obrigatório.", code: "MFA_REQUIRED" }, { status: 403, headers });
  }

  let body: unknown;
  try {
    if (Number(request.headers.get("content-length") || 0) > 8192) throw new Error("too large");
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Solicitação inválida." }, { status: 400, headers });
  }
  const parsed = validateFinancialCareRequest(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.code }, { status: 400, headers });

  const { data: subscription, error: dbError } = await createSupabaseAdmin()
    .from("billing_subscriptions")
    .select("id,plan_id,status,provider,current_period_end,cancel_at_period_end")
    .eq("user_id", user.id)
    .maybeSingle();
  if (dbError) return NextResponse.json({ error: "Consulta indisponível." }, { status: 503, headers });

  if (!subscription || subscription.provider !== "asaas" || !["active", "trialing"].includes(subscription.status)) {
    return NextResponse.json({ error: "Nenhuma assinatura Asaas elegível encontrada." }, { status: 409, headers });
  }
  if (parsed.action === "cancel_renewal" && subscription.cancel_at_period_end) {
    return NextResponse.json({ error: "Renovação já marcada para cancelamento." }, { status: 409, headers });
  }
  if (parsed.action === "downgrade") {
    const rank: Record<string, number> = { free: 0, pro: 1, premium: 2 };
    if (!parsed.targetPlan || rank[parsed.targetPlan] >= (rank[subscription.plan_id] ?? -1)) {
      return NextResponse.json({ error: "O plano selecionado não é inferior ao atual." }, { status: 409, headers });
    }
  }
  if (parsed.action === "request_refund") {
    return NextResponse.json({
      previewOnly: true,
      eligible: false,
      code: "PAYMENT_OWNERSHIP_CHECK_PENDING",
      message: "A propriedade do pagamento deve ser confirmada antes de registrar o pedido.",
    }, { status: 501, headers });
  }

  return NextResponse.json({
    previewOnly: true,
    eligible: true,
    action: parsed.action,
    currentPlan: subscription.plan_id,
    targetPlan: parsed.action === "downgrade" ? parsed.targetPlan : undefined,
    effectiveAt: subscription.current_period_end,
    requiresExplicitExecution: true,
    message: "Prévia validada. Nenhuma alteração financeira foi realizada.",
  }, { headers });
}
