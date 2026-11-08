import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "private, no-store" };

/**
 * Read-only checkout readiness. Never returns provider identifiers, keys or PII.
 * All state comes from server-controlled tables and environment flags.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ error: "Autenticação necessária." }, { status: 401, headers });
  }

  const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error) return NextResponse.json({ error: "Verificação de sessão indisponível." }, { status: 503, headers });
  if (assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2") {
    return NextResponse.json({ error: "Segundo fator obrigatório.", code: "MFA_REQUIRED" }, { status: 403, headers });
  }

  const sandbox = process.env.ASAAS_ENVIRONMENT === "sandbox";
  if (!sandbox) return NextResponse.json({ checkoutAvailable: false, reason: "sandbox_only" }, { headers });

  try {
    const admin = createSupabaseAdmin();
    const [customer, subscription] = await Promise.all([
      admin.from("asaas_customer_links").select("user_id").eq("user_id", user.id).maybeSingle(),
      admin.from("asaas_subscription_links").select("plan_id").eq("user_id", user.id).limit(1),
    ]);
    if (customer.error || subscription.error) throw new Error("Database unavailable");

    return NextResponse.json({
      environment: "sandbox",
      provider: "asaas",
      customerLinked: Boolean(customer.data),
      subscriptionLinked: Boolean(subscription.data?.length),
      checkoutAvailable: false,
      paymentActivationEnabled: false,
      provisioningConfigured: process.env.ASAAS_SANDBOX_PROVISIONING_ENABLED === "true",
      reconciliationConfigured: Boolean(process.env.ASAAS_RECONCILIATION_SECRET),
      checkoutConfigured: process.env.BILLING_CHECKOUT_ENABLED === "true",
      nextStep: customer.data ? "subscription_creation" : "customer_registration",
    }, { headers });
  } catch {
    return NextResponse.json({ error: "Não foi possível consultar o checkout." }, { status: 503, headers });
  }
}
