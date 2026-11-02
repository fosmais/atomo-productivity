import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { BILLING_PLANS } from "@/lib/billing/plans";

const headers = { "Cache-Control": "private, no-store" };
type PaidPlan = "pro" | "premium";
type PaymentMethod = "PIX" | "CREDIT_CARD";

/**
 * Authenticated, non-transactional checkout preparation.
 * This endpoint never creates a customer, payment, or subscription.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Autenticação necessária." }, { status: 401, headers });

  const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error) return NextResponse.json({ error: "Verificação indisponível." }, { status: 503, headers });
  if (assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2") {
    return NextResponse.json({ error: "Segundo fator obrigatório.", code: "MFA_REQUIRED" }, { status: 403, headers });
  }

  let body: unknown;
  try {
    if (Number(request.headers.get("content-length") || 0) > 2048) throw new Error("oversized");
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > 2048) throw new Error("oversized");
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400, headers });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400, headers });
  }
  const input = body as Record<string, unknown>;
  if (input.planId !== "pro" && input.planId !== "premium") {
    return NextResponse.json({ error: "Plano inválido." }, { status: 400, headers });
  }
  if (input.paymentMethod !== "PIX" && input.paymentMethod !== "CREDIT_CARD") {
    return NextResponse.json({ error: "Forma de pagamento inválida." }, { status: 400, headers });
  }
  if (process.env.ASAAS_ENVIRONMENT !== "sandbox") {
    return NextResponse.json({ error: "Simulação disponível somente no Sandbox." }, { status: 503, headers });
  }
  const planId: PaidPlan = input.planId;
  const paymentMethod: PaymentMethod = input.paymentMethod;
  const plan = BILLING_PLANS[planId];

  return NextResponse.json({
    environment: "sandbox",
    provider: "asaas",
    planId,
    planName: plan.name,
    amountCents: plan.monthlyPriceCents,
    currency: plan.currency,
    interval: "monthly",
    paymentMethod,
    checkoutAvailable: false,
    nextStep: "Cadastro do cliente e criação da assinatura ainda não habilitados.",
  }, { headers });
}
