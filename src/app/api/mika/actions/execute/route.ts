import { NextResponse } from "next/server";

// Fail closed until execution is bound to a persisted proposal, an atomic
// approval transition, an idempotency key and a valid plan_id.
// A client-provided "approved: true" is not sufficient authorization.
export async function POST() {
  return NextResponse.json(
    {
      error: "Execução de ações temporariamente indisponível até a homologação do fluxo de autorização.",
      code: "MIKA_EXECUTION_NOT_ENABLED"
    },
    { status: 503, headers: { "Cache-Control": "no-store" } }
  );
}
