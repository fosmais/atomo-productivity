import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { processOneAsaasSandboxReconciliationJob } from "@/lib/billing/asaas-reconciliation-worker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store" };

/**
 * Internal-only worker endpoint. No user session or webhook payload can invoke
 * it without a separate server-side bearer secret. No entitlement is granted.
 */
export async function POST(request: Request) {
  if (process.env.ASAAS_ENVIRONMENT !== "sandbox" ||
      process.env.ASAAS_RECONCILIATION_WORKER_ENABLED !== "true") {
    return NextResponse.json({ error: "Processamento desabilitado." }, { status: 503, headers });
  }
  const secret = process.env.ASAAS_RECONCILIATION_WORKER_SECRET;
  if (!secret || secret.length < 32) {
    return NextResponse.json({ error: "Configuração indisponível." }, { status: 503, headers });
  }
  const auth = request.headers.get("authorization") || "";
  const expected = Buffer.from(`Bearer ${secret}`);
  const supplied = Buffer.from(auth);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401, headers });
  }
  try {
    const result = await processOneAsaasSandboxReconciliationJob();
    return NextResponse.json({ ...result, entitlementGranted: false }, { headers });
  } catch {
    return NextResponse.json({ error: "Falha ao processar conciliação." }, { status: 503, headers });
  }
}
