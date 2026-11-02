import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function PATCH(request: Request) {
  try {
    if (process.env.MYRYRA_PROPOSAL_STATUS_ENABLED !== "true") {
      return NextResponse.json(
        { error: "Recurso ainda nao ativado." },
        { status: 503 }
      );
    }

    const supabase = await createClient();
    const { data: auth, error: authError } = await supabase.auth.getUser();

    if (authError || !auth.user) {
      return NextResponse.json(
        { error: "Nao autenticado." },
        { status: 401 }
      );
    }

    const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assurance.error) {
      return NextResponse.json(
        { error: "Verificação de sessão indisponível." },
        { status: 503 }
      );
    }
    if (assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2") {
      return NextResponse.json(
        { error: "Segundo fator obrigatório.", code: "MFA_REQUIRED" },
        { status: 403 }
      );
    }

    const mediaType = (request.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (mediaType !== "application/json") {
      return NextResponse.json({ error: "Envie JSON." }, { status: 415 });
    }
    const length = Number(request.headers.get("content-length"));
    if (Number.isFinite(length) && length > 4096) {
      return NextResponse.json({ error: "Requisição muito grande." }, { status: 413 });
    }
    let body: unknown;
    try {
      const reader = request.body?.getReader();
      if (!reader) return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
      const decoder = new TextDecoder();
      const chunks: string[] = [];
      let bytes = 0;
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > 4096) {
          await reader.cancel();
          return NextResponse.json({ error: "Requisição muito grande." }, { status: 413 });
        }
        chunks.push(decoder.decode(chunk.value, { stream: true }));
      }
      chunks.push(decoder.decode());
      body = JSON.parse(chunks.join(""));
    } catch {
      return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
    }

    if (
      typeof body !== "object" ||
      body === null ||
      Array.isArray(body)
    ) {
      return NextResponse.json(
        { error: "Dados invalidos." },
        { status: 400 }
      );
    }

    const input = body as Record<string, unknown>;
    const messageId = input.messageId;
    const kind = input.kind;

    if (
      typeof messageId !== "string" ||
      !isUuid(messageId) ||
      (kind !== "task" && kind !== "event")
    ) {
      return NextResponse.json(
        { error: "Solicitacao invalida." },
        { status: 400 }
      );
    }

    if (kind === "event") {
      const { data: result, error: cancelError } = await createSupabaseAdmin().rpc("myka_cancel_event", { p_message_id: messageId, p_user_id: auth.user.id });
      if (cancelError) throw cancelError;
      if (!result || typeof result !== "object" || Array.isArray(result) || result.status !== "cancelled") {
        return NextResponse.json({ error: "Proposta não está pendente." }, { status: 409 });
      }
    } else {
      const admin = createSupabaseAdmin();
      const { data: updated, error: updateError } = await admin.from("myka_messages")
        .update({ task_status: "cancelled" }).eq("id", messageId)
        .eq("user_id", auth.user.id).eq("role", "assistant")
        .eq("task_status", "pending").select("id").maybeSingle();
      if (updateError) throw updateError;
      if (!updated) return NextResponse.json({ error: "Proposta não está pendente." }, { status: 409 });
    }

    return NextResponse.json(
      { messageId, kind, status: "cancelled" },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    console.error("Erro ao cancelar proposta Myka:", error);

    return NextResponse.json(
      { error: "Falha ao cancelar proposta." },
      { status: 500 }
    );
  }
}
export async function POST(request: Request) {
  try {
    if (process.env.MYRYRA_PROPOSAL_STATUS_ENABLED !== "true") {
      return NextResponse.json({ error: "Confirmação persistente indisponível." }, { status: 503 });
    }
    const supabase = await createClient();
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assurance.error) return NextResponse.json({ error: "Sessão indisponível." }, { status: 503 });
    if (assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2") {
      return NextResponse.json({ error: "Segundo fator obrigatório.", code: "MFA_REQUIRED" }, { status: 403 });
    }
    if ((request.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase() !== "application/json") {
      return NextResponse.json({ error: "Envie JSON." }, { status: 415 });
    }
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > 4096) return NextResponse.json({ error: "Requisição muito grande." }, { status: 413 });
    let input: unknown;
    try { input = JSON.parse(raw); } catch { return NextResponse.json({ error: "JSON inválido." }, { status: 400 }); }
    if (!input || typeof input !== "object" || Array.isArray(input)) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
    const messageId = (input as Record<string, unknown>).messageId;
    if (typeof messageId !== "string" || !isUuid(messageId)) return NextResponse.json({ error: "Mensagem inválida." }, { status: 400 });

    const admin = createSupabaseAdmin();
    const { data: message, error: messageError } = await admin.from("myka_messages")
      .select("id, proposed_event, event_status").eq("id", messageId)
      .eq("user_id", auth.user.id).eq("role", "assistant").maybeSingle();
    if (messageError) throw messageError;
    if (!message || !message.proposed_event || typeof message.proposed_event !== "object" || Array.isArray(message.proposed_event)) {
      return NextResponse.json({ error: "Proposta não encontrada." }, { status: 404 });
    }
    if (message.event_status === "cancelled") return NextResponse.json({ error: "Proposta descartada." }, { status: 409 });
    const event = message.proposed_event as Record<string, unknown>;
    const title = typeof event.title === "string" ? event.title.trim() : "";
    const startsAt = typeof event.startsAt === "string" ? new Date(event.startsAt) : new Date(NaN);
    const endsAt = typeof event.endsAt === "string" ? new Date(event.endsAt) : new Date(NaN);
    if (!title || title.length > 200 || !title.match(/[a-zA-Z0-9À-ÿ]/u) ||
        Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) {
      return NextResponse.json({ error: "Dados do compromisso inválidos." }, { status: 422 });
    }
    const eventType = event.eventType ?? "appointment";
    if (eventType !== "appointment" && eventType !== "unavailable") {
      return NextResponse.json({ error: "Tipo inválido." }, { status: 422 });
    }
    // A single database transaction serializes confirmation and cancellation.
    const { data: result, error: confirmError } = await admin.rpc("myka_confirm_event", {
      p_message_id: messageId,
      p_user_id: auth.user.id,
    });
    if (confirmError) throw confirmError;
    if (!result || typeof result !== "object" || Array.isArray(result)) {
      throw new Error("Resposta inválida da confirmação.");
    }
    const outcome = result as Record<string, unknown>;
    if (outcome.status === "cancelled") {
      return NextResponse.json({ error: "Proposta descartada." }, { status: 409 });
    }
    if (outcome.status !== "saved") {
      return NextResponse.json({ error: "Proposta indisponível." }, { status: 409 });
    }
    return NextResponse.json({ messageId, status: "saved" }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Erro ao confirmar evento Myka:", error);
    return NextResponse.json({ error: "Falha ao confirmar compromisso." }, { status: 500 });
  }
}
