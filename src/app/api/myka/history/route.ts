import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

type MessageInput = {
  conversationId?: string;
  role: "user";
  content: string;
  proposedTask?: unknown;
  proposedEvent?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function GET() {
  try {
    const supabase = await createClient();

    const { data: auth, error: authError } = await supabase.auth.getUser();

    if (authError || !auth.user) {
      return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
    }

    const userId = auth.user.id;

    const { data: conversation, error: conversationError } = await supabase
      .from("myka_conversations")
      .select("id, title, created_at, updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (conversationError) {
      throw conversationError;
    }

    if (!conversation) {
      return NextResponse.json({
        conversationId: null,
        messages: [],
      });
    }

    const statusEnabled =
      process.env.MYRYRA_PROPOSAL_STATUS_ENABLED === "true";

    const baseQuery = () =>
      supabase
        .from("myka_messages")
        .select("id, role, content, proposed_task, proposed_event, created_at")
        .eq("user_id", userId)
        .eq("conversation_id", conversation.id)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(100);

    const statusQuery = () =>
      supabase
        .from("myka_messages")
        .select("id, role, content, proposed_task, proposed_event, task_status, event_status, created_at")
        .eq("user_id", userId)
        .eq("conversation_id", conversation.id)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(100);

    const result = statusEnabled
      ? await statusQuery()
      : await baseQuery();

    const messages = result.data;
    const messagesError = result.error;
    if (messagesError) {
      throw messagesError;
    }

    return NextResponse.json({
      conversationId: conversation.id,
      messages: (messages ?? []).reverse().map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        proposedTask: message.proposed_task,
        proposedEvent: message.proposed_event,
        taskStatus:
          "task_status" in message && typeof message.task_status === "string"
            ? message.task_status
            : "legacy",
        eventStatus:
          "event_status" in message && typeof message.event_status === "string"
            ? message.event_status
            : "legacy",
        createdAt: message.created_at,
      })),
    });
  } catch (error) {
    console.error("Erro ao recuperar historico Myka:", error);

    return NextResponse.json(
      { error: "Falha ao recuperar historico." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const { data: auth, error: authError } = await supabase.auth.getUser();

    if (authError || !auth.user) {
      return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
    }

    const userId = auth.user.id;
    const mykaAdmin = createSupabaseAdmin();
    const body: unknown = await request.json();

    if (!isRecord(body)) {
      return NextResponse.json({ error: "Dados invalidos." }, { status: 400 });
    }

    const role = body.role;
    const content = body.content;
    const conversationIdInput = body.conversationId;

    if (
      role !== "user" ||
      typeof content !== "string" ||
      !content.trim() ||
      content.length > 20000 ||
      (conversationIdInput !== undefined &&
        (typeof conversationIdInput !== "string" ||
          !isUuid(conversationIdInput)))
    ) {
      return NextResponse.json({ error: "Mensagem invalida." }, { status: 400 });
    }

    const message: MessageInput = {
      role,
      content: content.trim(),
      ...(typeof conversationIdInput === "string"
        ? { conversationId: conversationIdInput }
        : {}),
    };

    let conversationId = message.conversationId;

    if (conversationId) {
      const { data: existing, error: lookupError } = await mykaAdmin
        .from("myka_conversations")
        .select("id")
        .eq("id", conversationId)
        .eq("user_id", userId)
        .maybeSingle();

      if (lookupError) throw lookupError;

      if (!existing) {
        return NextResponse.json(
          { error: "Conversa nao encontrada." },
          { status: 404 }
        );
      }
    } else {
      const title = message.role === "user"
        ? message.content.slice(0, 100)
        : "Nova conversa";

      const { data: created, error: createError } = await mykaAdmin
        .from("myka_conversations")
        .insert({ user_id: userId, title })
        .select("id")
        .single();

      if (createError || !created) {
        throw createError ?? new Error("Falha ao criar conversa.");
      }

      conversationId = created.id;
    }

    const { data: saved, error: saveError } = await mykaAdmin
      .from("myka_messages")
      .insert({
        conversation_id: conversationId,
        user_id: userId,
        role: message.role,
        content: message.content,
        proposed_task: null,
        proposed_event: null,
      })
      .select("id")
      .single();

    if (saveError || !saved) throw saveError ?? new Error("Falha ao salvar.");

    const { error: updateError } = await mykaAdmin
      .from("myka_conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversationId)
      .eq("user_id", userId);

    if (updateError) throw updateError;

    return NextResponse.json({
      conversationId,
      messageId: saved.id,
    });
  } catch (error) {
    console.error("Erro ao salvar historico Myka:", error);

    return NextResponse.json(
      { error: "Falha ao salvar mensagem." },
      { status: 500 }
    );
  }
}