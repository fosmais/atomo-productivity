import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { asaasSandboxReady, createAsaasSandboxMonthlySubscription } from "@/lib/billing/asaas";
import { ensureAsaasSandboxCustomerForAuthenticatedUser } from "@/lib/billing/asaas-customer-links";
import { reserveAsaasCheckoutAttempt, advanceAsaasCheckoutAttempt } from "@/lib/billing/asaas-checkout-attempts";
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
  // An independent opt-in gate prevents an accidental live checkout when
  // the existing preflight feature flag is enabled.
  if (process.env.ASAAS_SANDBOX_CHECKOUT_EXECUTION_ENABLED !== "true" ||
      process.env.ASAAS_SANDBOX_PROVISIONING_ENABLED !== "true") {
    return NextResponse.json({
      provider: "asaas", environment: "sandbox",
      plan: { id: plan.id, monthlyPriceCents: plan.monthlyPriceCents, currency: plan.currency, aiMessagesPerDay: plan.aiMessagesPerDay },
      code: "CHECKOUT_NOT_IMPLEMENTED",
      error: "Contratação Sandbox aguardando habilitação específica e homologação.",
      chargeCreated: false,
    }, { status: 501, headers });
  }

  // Only Supabase-authenticated identity is used; never trust customer IDs
  // or email/name supplied by the checkout request.
  const email = user.email;
  const name = typeof user.user_metadata?.full_name === "string"
    ? user.user_metadata.full_name.trim()
    : "";
  if (!email || name.length < 2) {
    return NextResponse.json({
      error: "Atualize seu nome e e-mail antes de contratar.",
      code: "PROFILE_INCOMPLETE",
    }, { status: 422, headers });
  }

  let attemptId: string;
  try {
    const attempt = await reserveAsaasCheckoutAttempt(user.id, planId as "pro" | "premium");
    attemptId = attempt.id;
  } catch {
    return NextResponse.json({
      error: "Já existe uma contratação em andamento ou pendente de conciliação.",
      code: "CHECKOUT_IN_PROGRESS",
    }, { status: 409, headers });
  }

  let phase: "reserved" | "customer_linked" = "reserved";
  try {
    const customerId = await ensureAsaasSandboxCustomerForAuthenticatedUser({
      id: user.id, email, name,
    });
    await advanceAsaasCheckoutAttempt({
      id: attemptId, userId: user.id, from: "reserved", to: "customer_linked",
    });
    phase = "customer_linked";
    const subscriptionId = await createAsaasSandboxMonthlySubscription({
      customerId, planId: planId as "pro" | "premium", externalReference: attemptId,
    });
    await advanceAsaasCheckoutAttempt({
      id: attemptId, userId: user.id, from: "customer_linked",
      to: "subscription_created", subscriptionId,
    });
    return NextResponse.json({
      provider: "asaas", environment: "sandbox", attemptId,
      plan: { id: plan.id, monthlyPriceCents: plan.monthlyPriceCents, currency: plan.currency },
      code: "SANDBOX_SUBSCRIPTION_CREATED",
      entitlementGranted: false,
      message: "Assinatura de teste criada. Acesso pago depende de conciliação.",
    }, { status: 202, headers });
  } catch {
    // A remote write might have succeeded even if its response failed.
    // Never retry automatically; keep the reservation blocked for review.
    try {
      await advanceAsaasCheckoutAttempt({
        id: attemptId, userId: user.id, from: phase, to: "manual_review",
      });
    } catch { /* preserve the original error and fail closed */ }
    return NextResponse.json({
      error: "Não foi possível concluir a contratação de teste. Aguarde conciliação.",
      code: "SANDBOX_RECONCILIATION_REQUIRED", attemptId,
      entitlementGranted: false,
    }, { status: 503, headers });
  }
}

export async function GET() {
  return NextResponse.json({ error: "Método não permitido." }, { status: 405, headers });
}

/* Previous preflight response retained below for historical reference.
  return NextResponse.json({
    provider: "asaas",
    environment: "sandbox",
    plan: { id: plan.id, monthlyPriceCents: plan.monthlyPriceCents, currency: plan.currency, aiMessagesPerDay: plan.aiMessagesPerDay },
    code: "CHECKOUT_NOT_IMPLEMENTED",
    error: "Pré-validação concluída. Cadastro do cliente, recorrência e conciliação de pagamentos ainda precisam ser implementados.",
    chargeCreated: false,
  }, { status: 501, headers });
}

*/
