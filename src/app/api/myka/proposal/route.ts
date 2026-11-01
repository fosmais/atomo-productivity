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

    const admin = createSupabaseAdmin();
    const column = kind === "task" ? "task_status" : "event_status";

    const { data: updated, error: updateError } = await admin
      .from("myka_messages")
      .update({ [column]: "cancelled" })
      .eq("id", messageId)
      .eq("user_id", auth.user.id)
      .eq("role", "assistant")
      .eq(column, "pending")
      .select("id")
      .maybeSingle();

    if (updateError) {
      throw updateError;
    }

    if (!updated) {
      return NextResponse.json(
        { error: "Proposta nao esta pendente ou nao foi encontrada." },
        { status: 409 }
      );
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