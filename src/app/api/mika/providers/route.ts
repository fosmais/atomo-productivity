import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { MIKA_PROVIDER_CATALOG } from "@/lib/mika/provider-capabilities";

const headers = { "Cache-Control": "private, no-store" };

/**
 * Authenticated capability discovery only. This is not a connection-status
 * endpoint and does not imply that a provider has been authorized.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ error: "Autenticação necessária." }, { status: 401, headers });
  }

  const providers = Object.entries(MIKA_PROVIDER_CATALOG).map(([id, item]) => ({
    id,
    label: item.label,
    integration: item.integration,
    capabilities: item.capabilities,
    note: item.note,
    connectionVerified: false,
    executionAvailable: false,
  }));

  return NextResponse.json({
    providers,
    disclaimer: "Catálogo de capacidades, não confirmação de conexão ou execução.",
  }, { headers });
}
