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

    const body: unknown = await request.json();

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

    return NextResponse.json({
      messageId,
      kind,
      status: "cancelled",
    });
  } catch (error) {
    console.error("Erro ao cancelar proposta Myka:", error);

    return NextResponse.json(
      { error: "Falha ao cancelar proposta." },
      { status: 500 }
    );
  }
}