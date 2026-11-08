import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { asaasSandboxReady } from "@/lib/billing/asaas";
import { BILLING_PLANS } from "@/lib/billing/plans";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const headers = { "Cache-Control": "no-store" };
/** Sandbox only. Customer creation, subscription creation and payment confirmation
 * must be implemented and tested before this route can initiate any charge. */
export async function POST(request: Request) {
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
  const raw = await request.text().catch(() => "");
  if (!raw || Buffer.byteLength(raw, "utf8") > 4096) {
    return NextResponse.json({ error: "Solicitação inválida." }, { status: 400, headers });
  }
  let body: unknown;
  try { body = JSON.parse(raw); } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400, headers });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Solicitação inválida." }, { status: 400, headers });
  }
  const { planId } = body as Record<string, unknown>;
  if (planId !== "pro" && planId !== "premium") {
    return NextResponse.json({ error: "Selecione um plano pago válido." }, { status: 422, headers });
  }
  // Billing is blocked until current published legal terms have explicit acceptance.
  // A missing document, missing acceptance or database failure must fail closed.
  try {
    const admin = createSupabaseAdmin();
    const { data: documents, error: documentsError } = await admin
      .from("myryra_privacy_document_versions")
      .select("id,document_type,effective_at")
      .eq("status", "published")
      .lte("effective_at", new Date().toISOString())
      .order("effective_at", { ascending: false });
    if (documentsError || !documents || documents.length === 0) {
      return NextResponse.json({ error: "Termos legais indisponíveis.", code: "LEGAL_TERMS_UNAVAILABLE" }, { status: 503, headers });
    }
    const currentDocuments = [...new Map([...documents].reverse().map((document) => [document.document_type, document])).values()];
    const { data: acceptances, error: acceptanceError } = await admin
      .from("myryra_privacy_acceptances")
      .select("document_version_id")
      .eq("user_id", user.id)
      .eq("action", "accepted")
      .in("document_version_id", currentDocuments.map((document) => document.id));
    if (acceptanceError) throw acceptanceError;
    const accepted = new Set((acceptances ?? []).map((acceptance) => acceptance.document_version_id));
    if (currentDocuments.some((document) => !accepted.has(document.id))) {
      return NextResponse.json({ error: "Aceite dos termos necessário.", code: "LEGAL_ACCEPTANCE_REQUIRED" }, { status: 403, headers });
    }
  } catch {
    return NextResponse.json({ error: "Validação legal temporariamente indisponível.", code: "LEGAL_CHECK_UNAVAILABLE" }, { status: 503, headers });
  }
  const plan = BILLING_PLANS[planId];
  return NextResponse.json({
    provider: "asaas", environment: "sandbox", planId: plan.id,
    monthlyPriceCents: plan.monthlyPriceCents,
    checkoutImplemented: false,
    error: "Checkout em preparação: cadastro do cliente, recorrência e conciliação pendentes.",
  }, { status: 501, headers });
}

/** Read-only readiness probe. Never creates a customer, subscription, or payment. */
export async function GET() {
  const sandboxConfigured = asaasSandboxReady();
  const provisioningEnabled = process.env.ASAAS_SANDBOX_PROVISIONING_ENABLED === "true";
  const checkoutEnabled = process.env.BILLING_CHECKOUT_ENABLED === "true";
  const entitlementsEnabled = process.env.BILLING_ENTITLEMENTS_ENABLED === "true";
  const reconciliationQueueEnabled = process.env.ASAAS_RECONCILIATION_QUEUE_ENABLED === "true";
  const reconciliationWorkerEnabled = process.env.ASAAS_RECONCILIATION_WORKER_ENABLED === "true";
  const reconciliationWorkerConfigured = Boolean(process.env.ASAAS_RECONCILIATION_WORKER_SECRET && process.env.ASAAS_RECONCILIATION_WORKER_SECRET.length >= 32);
  return NextResponse.json({
    provider: "asaas", environment: "sandbox",
    sandboxConfigured,
    provisioningEnabled,
    checkoutEnabled,
    entitlementsEnabled,
    reconciliationQueueEnabled,
    reconciliationWorkerEnabled,
    reconciliationWorkerConfigured,
    checkoutImplemented: false,
    readyForPurchase: false,
    reason: "Cadastro de clientes, assinatura e conciliacao ainda nao homologados.",
  }, { headers });
}
