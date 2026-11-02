import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const headers = { "Cache-Control": "private, no-store" };
async function authorize() {
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return { error: NextResponse.json({ error: "Autenticação necessária." }, { status: 401, headers }) };
  const assurance = await client.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error || assurance.data.currentLevel !== "aal2") {
    return { error: NextResponse.json({ error: "Verificação de segurança necessária." }, { status: 403, headers }) };
  }
  const admin = createSupabaseAdmin();
  const { data, error: lookupError } = await admin.from("support_admins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (lookupError || !data) return { error: NextResponse.json({ error: "Acesso não autorizado." }, { status: 403, headers }) };
  return { admin, userId: user.id };
}

export async function GET() {
  try {
    const access = await authorize();
    if (access.error) return access.error;
    const { data, error } = await access.admin!.from("support_tickets")
      .select("id,user_id,subject,message,category,status,priority,myka_authorized,created_at,updated_at")
      .order("created_at", { ascending: false }).limit(100);
    if (error) throw error;
    const ids = (data ?? []).map(ticket => ticket.id);
    const { data: events, error: eventsError } = ids.length ? await access.admin!.from("support_ticket_events").select("id,ticket_id,actor_id,previous_status,new_status,previous_priority,new_priority,created_at").in("ticket_id", ids).order("created_at", { ascending: false }).limit(300) : { data: [], error: null };
    if (eventsError) throw eventsError;
    // Resolve contact details server-side only after admin authorization and MFA.
    // Never expose auth.users or user metadata through the public ticket endpoint.
    const userIds = [...new Set((data ?? []).map(ticket => ticket.user_id))];
    const contacts = await Promise.all(userIds.map(async userId => {
      const { data: record, error: contactError } = await access.admin!.auth.admin.getUserById(userId);
      if (contactError || !record.user) return [userId, { name: null, email: null, phone: null }] as const;
      const user = record.user;
      const metadata = user.user_metadata ?? {};
      const name = [metadata.full_name, metadata.name].find(value => typeof value === "string" && value.trim()) ?? null;
      return [userId, { name, email: user.email ?? null, phone: user.phone || null }] as const;
    }));
    const contactById = new Map(contacts);
    const tickets = (data ?? []).map(ticket => ({ ...ticket, contact: contactById.get(ticket.user_id) ?? { name: null, email: null, phone: null } }));
    const { data: replies, error: replyError } = ids.length ? await access.admin!.from("support_ticket_replies").select("id,ticket_id,author_type,body,created_at").in("ticket_id",ids).order("created_at",{ascending:true}).limit(500) : { data: [], error: null };
    if (replyError) throw replyError;
    return NextResponse.json({ tickets, events: events ?? [], replies: replies ?? [] }, { headers });
  } catch {
    return NextResponse.json({ error: "Consulta indisponível." }, { status: 503, headers });
  }
}

export async function PATCH(request: Request) {
  try {
    const access = await authorize();
    if (access.error) return access.error;
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Dados inválidos." }, { status: 400, headers });
    const { id, status, priority } = body as Record<string, unknown>;
    if (typeof id !== "string" || !/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(id)) return NextResponse.json({ error: "Protocolo inválido." }, { status: 400, headers });
    const changes: Record<string, string> = {};
    if (status !== undefined) {
      if (!["open","in_progress","resolved","closed"].includes(String(status))) return NextResponse.json({ error: "Status inválido." }, { status: 400, headers });
      changes.status = String(status);
    }
    if (priority !== undefined) {
      if (!["low","normal","high","urgent"].includes(String(priority))) return NextResponse.json({ error: "Prioridade inválida." }, { status: 400, headers });
      changes.priority = String(priority);
    }
    if (!Object.keys(changes).length) return NextResponse.json({ error: "Nenhuma alteração." }, { status: 400, headers });
    const { data, error } = await access.admin!.rpc("admin_update_support_ticket", {
      p_ticket_id: id,
      p_actor_id: access.userId,
      p_status: changes.status ?? null,
      p_priority: changes.priority ?? null,
    });
    if (error) throw error;
    if (!data?.length) return NextResponse.json({ error: "Chamado não encontrado." }, { status: 404, headers });

    return NextResponse.json({ ticket: data[0] }, { headers });
  } catch {
    return NextResponse.json({ error: "Atualização indisponível." }, { status: 503, headers });
  }
}
