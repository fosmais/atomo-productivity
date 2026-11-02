import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const noStore = { "Cache-Control": "no-store" };

function matchesToken(provided: string | null, expected: string): boolean {
  if (!provided || !expected) return false;
  const actual = Buffer.from(provided, "utf8");
  const secret = Buffer.from(expected, "utf8");
  return actual.length === secret.length && timingSafeEqual(actual, secret);
}

/**
 * Asaas Sandbox webhook receiver (phase 1).
 * Fail closed until event persistence, idempotency and subscription reconciliation
 * are implemented. Never acknowledge a payment event before durable processing.
 */
export async function POST(request: Request) {
  if (process.env.ASAAS_ENVIRONMENT !== "sandbox" ||
      !process.env.ASAAS_WEBHOOK_TOKEN ||
      !process.env.ASAAS_API_KEY) {
    return NextResponse.json({ error: "Webhook indisponível." }, { status: 503, headers: noStore });
  }

  if (!matchesToken(request.headers.get("asaas-access-token"), process.env.ASAAS_WEBHOOK_TOKEN)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401, headers: noStore });
  }

  const contentLength = Number(request.headers.get("content-length") || "0");
  if (contentLength > 65536) {
    return NextResponse.json({ error: "Evento muito grande." }, { status: 413, headers: noStore });
  }

  let payload: unknown;
  try {
    const body = await request.text();
    if (Buffer.byteLength(body, "utf8") > 65536) {
      return NextResponse.json({ error: "Evento muito grande." }, { status: 413, headers: noStore });
    }
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400, headers: noStore });
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload) ||
      typeof (payload as Record<string, unknown>).id !== "string" ||
      typeof (payload as Record<string, unknown>).event !== "string") {
    return NextResponse.json({ error: "Evento inválido." }, { status: 400, headers: noStore });
  }

  // Intentionally return 503: Asaas retries, rather than silently losing
  // an event before the durable event inbox and reconciliation are deployed.
  return NextResponse.json(
    { error: "Recepção validada; processamento de eventos ainda não habilitado." },
    { status: 503, headers: noStore },
  );
}
