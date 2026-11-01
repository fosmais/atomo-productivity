import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { asaasSandboxReady } from "@/lib/billing/asaas";

const headers = { "Cache-Control": "no-store" };
export async function POST(request: Request) {
  if (!asaasSandboxReady()) return NextResponse.json({ error: "Webhook desabilitado." }, { status: 503, headers });
  const expected = Buffer.from(process.env.ASAAS_WEBHOOK_TOKEN!);
  const supplied = Buffer.from(request.headers.get("asaas-access-token") || "");
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401, headers });
  }
  const maxBytes = 32768;
  const reader = request.body?.getReader();
  if (!reader) return NextResponse.json({ error: "Corpo ausente." }, { status: 400, headers });
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return NextResponse.json({ error: "Evento muito grande." }, { status: 413, headers });
      }
      chunks.push(value);
    }
  } catch {
    return NextResponse.json({ error: "Falha ao ler evento." }, { status: 400, headers });
  }
  const raw = Buffer.concat(chunks, total).toString("utf8");
  let data: unknown;
  try { data = JSON.parse(raw); } catch { return NextResponse.json({ error: "JSON inválido." }, { status: 400, headers }); }
  if (!data || typeof data !== "object") return NextResponse.json({ error: "Evento inválido." }, { status: 400, headers });
  const event = data as Record<string, unknown>;
  if (typeof event.id !== "string" || !/^[\w-]{1,128}$/.test(event.id) ||
      typeof event.event !== "string" || !/^[A-Z_]{1,100}$/.test(event.event)) {
    return NextResponse.json({ error: "Evento inválido." }, { status: 400, headers });
  }
  const { error } = await createSupabaseAdmin().from("billing_webhook_events").upsert({
    provider: "asaas", provider_event_id: event.id, event_type: event.event,
  }, { onConflict: "provider,provider_event_id", ignoreDuplicates: true });
  if (error) return NextResponse.json({ error: "Falha ao persistir evento." }, { status: 503, headers });
  // Recording a notification does not verify payment or grant a paid plan.
  return NextResponse.json({ received: true, entitlementGranted: false }, { headers });
}
