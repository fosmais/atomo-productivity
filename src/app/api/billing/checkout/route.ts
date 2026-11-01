import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { BILLING_PLANS } from "@/lib/billing/plans";

const noStore = { "Cache-Control": "no-store" };
type PaidPlan = "pro" | "premium";

export async function POST(request: Request) {
  if (process.env.BILLING_CHECKOUT_ENABLED !== "true" ||
      process.env.BILLING_ENTITLEMENTS_ENABLED !== "true") {
    return NextResponse.json({ error: "Contratação ainda não disponível." }, { status: 503, headers: noStore });
  }
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  const appUrl = process.env.MYRYRA_APP_URL;
  if (!token || !appUrl || !/^https:\/\/[^/]+$/.test(appUrl)) {
    return NextResponse.json({ error: "Checkout não configurado." }, { status: 503, headers: noStore });
  }
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user?.email) {
    return NextResponse.json({ error: "Autenticação necessária." }, { status: 401, headers: noStore });
  }
  const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error) return NextResponse.json({ error: "Verificação indisponível." }, { status: 503, headers: noStore });
  if (assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2") {
    return NextResponse.json({ error: "Segundo fator obrigatório.", code: "MFA_REQUIRED" }, { status: 403, headers: noStore });
  }
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    return NextResponse.json({ error: "Envie JSON." }, { status: 415, headers: noStore });
  }
  const declared = request.headers.get("content-length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > 1024)) {
    return NextResponse.json({ error: "Requisição muito grande." }, { status: 413, headers: noStore });
  }
  let body: unknown;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > 1024) return NextResponse.json({ error: "Requisição muito grande." }, { status: 413, headers: noStore });
    body = JSON.parse(raw);
  } catch { return NextResponse.json({ error: "JSON inválido." }, { status: 400, headers: noStore }); }
  const planId = typeof body === "object" && body !== null && "planId" in body ? body.planId : null;
  if (planId !== "pro" && planId !== "premium") {
    return NextResponse.json({ error: "Plano inválido." }, { status: 400, headers: noStore });
  }
  const plan = BILLING_PLANS[planId as PaidPlan];
  try {
    const response = await fetch("https://api.mercadopago.com/preapproval", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify({
        reason: `MYRYRA ${plan.name} - mensal`,
        external_reference: `myryra:${user.id}:${planId}`,
        payer_email: user.email,
        auto_recurring: { frequency: 1, frequency_type: "months", transaction_amount: plan.monthlyPriceCents / 100, currency_id: "BRL" },
        back_url: `${appUrl}/dashboard`,
        status: "pending",
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) return NextResponse.json({ error: "Não foi possível iniciar a assinatura." }, { status: 502, headers: noStore });
    const data: unknown = await response.json();
    const url = typeof data === "object" && data !== null && "init_point" in data ? data.init_point : null;
    if (typeof url !== "string" || !url.startsWith("https://www.mercadopago.com")) {
      return NextResponse.json({ error: "Resposta inválida do provedor." }, { status: 502, headers: noStore });
    }
    return NextResponse.json({ checkoutUrl: url, planId, provider: "mercadopago" }, { headers: noStore });
  } catch {
    return NextResponse.json({ error: "Provedor de pagamentos indisponível." }, { status: 502, headers: noStore });
  }
}
