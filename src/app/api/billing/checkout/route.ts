import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { asaasSandboxReady } from "@/lib/billing/asaas";
import { BILLING_PLANS, type BillingPlanId } from "@/lib/billing/plans";

const headers = { "Cache-Control": "private, no-store" };
const eligiblePlans: readonly BillingPlanId[] = ["pro", "premium"];

/**
 * Sandbox-only checkout preflight. Does not create customers, subscriptions,
 * invoices, or entitlements. Those require a separate reviewed implementation.
 */
export async function POST(request: Request) {
  if (!asaasSandboxReady() || process.env.BILLING_CHECKOUT_ENABLED !== "true") {
    return NextResponse.json({ error: "Contratação ainda não disponível.", code: "CHECKOUT_DISABLED" }, { status: 503, headers });
  }

  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Autenticação necessária." }, { status: 401, headers });

  const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error) return NextResponse.json({ error: "Verificação indisponível." }, { status: 503, headers });
  if (assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2") {
    return NextResponse.json({ error: "Segundo fator obrigatório.", code: "MFA_REQUIRED" }, { status: 403, headers });
  }

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 2048) return NextResponse.json({ error: "Solicitação muito grande." }, { status: 413, headers });
  let body: unknown;
  try {
    const raw = await request.text();
    if (raw.length > 2048) return NextResponse.json({ error: "Solicitação muito grande." }, { status: 413, headers });
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400, headers });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Solicitação inválida." }, { status: 400, headers });
  }
  const planId = (body as Record<string, unknown>).planId;
  if (typeof planId !== "string" || !eligiblePlans.includes(planId as BillingPlanId)) {
    return NextResponse.json({ error: "Selecione um plano Pro ou Premium.", code: "INVALID_PLAN" }, { status: 422, headers });
  }

  // Price and limits come exclusively from the server-side catalog, never the browser.
  const plan = BILLING_PLANS[planId as "pro" | "premium"];
  return NextResponse.json({
    provider: "asaas",
    environment: "sandbox",
    plan: { id: plan.id, monthlyPriceCents: plan.monthlyPriceCents, currency: plan.currency, aiMessagesPerDay: plan.aiMessagesPerDay },
    code: "CHECKOUT_NOT_IMPLEMENTED",
    error: "Pré-validação concluída. Cadastro do cliente, recorrência e conciliação de pagamentos ainda precisam ser implementados.",
    chargeCreated: false,
  }, { status: 501, headers });
}
