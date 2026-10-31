import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserEntitlements } from "@/lib/billing/entitlements";

/** Read-only account billing status. Never trusts client-supplied plan IDs. */
export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ error: "Usuário não autenticado." }, { status: 401 });
  }
  const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error) {
    return NextResponse.json({ error: "Verificação de sessão indisponível." }, { status: 503 });
  }
  if (assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2") {
    return NextResponse.json({ error: "Segundo fator obrigatório.", code: "MFA_REQUIRED" }, { status: 403 });
  }
  if (process.env.BILLING_ENTITLEMENTS_ENABLED !== "true") {
    return NextResponse.json(
      { error: "Assinaturas ainda não habilitadas." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
  try {
    const entitlements = await getUserEntitlements(user.id);
    return NextResponse.json(
      {
        planId: entitlements.planId,
        name: entitlements.name,
        aiMessagesPerDay: entitlements.aiMessagesPerDay,
        features: entitlements.features,
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch {
    return NextResponse.json(
      { error: "Não foi possível consultar sua assinatura." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
