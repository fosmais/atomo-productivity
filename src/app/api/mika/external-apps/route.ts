import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/supabase/request-client";
import { listExternalAppConnections } from "@/lib/mika/external-app-connections";

/**
 * Authenticated, read-only capability inventory.
 * Do not return provider credentials or imply that existing tokens are valid.
 */
export async function GET(request: Request) {
  try {
    const { user, mfaRequired, assuranceUnavailable } = await authenticateRequest(request);
    if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    if (assuranceUnavailable || mfaRequired) {
      return NextResponse.json({ error: "Verificação de segurança necessária." }, { status: 403 });
    }
    return NextResponse.json(
      { apps: listExternalAppConnections(), connectionVerification: "not_performed" },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "Não foi possível consultar aplicativos." }, { status: 500 });
  }
}
