import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { asaasSandboxReady } from "@/lib/billing/asaas";

const headers = { "Cache-Control": "no-store" };
/** Sandbox only. Customer creation, subscription creation and payment confirmation
 * must be implemented and tested before this route can initiate any charge. */
export async function POST() {
  if (!asaasSandboxReady() || process.env.BILLING_CHECKOUT_ENABLED !== "true") {
    return NextResponse.json({ error: "Contratação ainda não disponível." }, { status: 503, headers });
  }
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Autenticação necessária." }, { status: 401, headers });
  const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error) return NextResponse.json({ error: "Verificação indisponível." }, { status: 503, headers });
  if (assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2") {
    return NextResponse.json({ error: "Segundo fator obrigatório.", code: "MFA_REQUIRED" }, { status: 403, headers });
  }
  return NextResponse.json({
    provider: "asaas", environment: "sandbox",
    error: "Checkout em preparação: cadastro do cliente, recorrência e conciliação pendentes.",
  }, { status: 501, headers });
}
