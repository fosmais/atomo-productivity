import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { provisionAsaasSandboxCustomer, provisionAsaasSandboxSubscription } from "@/lib/billing/provision-asaas";

const headers = { "Cache-Control": "private, no-store" };

/** Explicitly gated, authenticated Sandbox-only test. Never grants entitlements. */
export async function POST(request: Request) {
  if (process.env.ASAAS_ENVIRONMENT !== "sandbox" ||
      process.env.ASAAS_SANDBOX_PROVISIONING_ENABLED !== "true" ||
      process.env.ASAAS_SANDBOX_TEST_ENDPOINT_ENABLED !== "true" ||
      process.env.BILLING_CHECKOUT_ENABLED === "true") {
    return NextResponse.json({ error: "Homologação não habilitada." }, { status: 503, headers });
  }

  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user || !user.email) {
    return NextResponse.json({ error: "Autenticação necessária." }, { status: 401, headers });
  }
  const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error || (assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2")) {
    return NextResponse.json({ error: "Verificação adicional necessária." }, { status: 403, headers });
  }
  if (Number(request.headers.get("content-length") || 0) > 2048) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400, headers });
  }
  let input: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > 2048) throw new Error("large");
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid");
    input = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400, headers });
  }
  const { name, cpfCnpj, planId, billingType } = input;
  if (typeof name !== "string" || typeof cpfCnpj !== "string" ||
      (planId !== "pro" && planId !== "premium") ||
      (billingType !== "PIX" && billingType !== "CREDIT_CARD")) {
    return NextResponse.json({ error: "Parâmetros inválidos." }, { status: 400, headers });
  }

  try {
    const customerId = await provisionAsaasSandboxCustomer(user.id, name, user.email, cpfCnpj);
    const subscriptionId = await provisionAsaasSandboxSubscription(user.id, planId, billingType);
    return NextResponse.json({
      environment: "sandbox", customerLinked: Boolean(customerId),
      subscriptionLinked: Boolean(subscriptionId), entitlementsActivated: false,
    }, { status: 201, headers });
  } catch {
    return NextResponse.json({
      error: "Operação não concluída ou resultado incerto. Verifique a conciliação antes de repetir.",
    }, { status: 409, headers });
  }
}
