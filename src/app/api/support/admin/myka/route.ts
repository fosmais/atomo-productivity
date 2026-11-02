import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const headers = { "Cache-Control": "private, no-store" };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: "Autenticação necessária." }, { status: 401, headers });
    const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assurance.error || assurance.data.currentLevel !== "aal2") return NextResponse.json({ error: "MFA necessário." }, { status: 403, headers });
    const admin = createSupabaseAdmin();
    const { data: member, error: memberError } = await admin.from("support_admins").select("user_id").eq("user_id", user.id).maybeSingle();
    if (memberError || !member) return NextResponse.json({ error: "Acesso não autorizado." }, { status: 403, headers });
    const body = await request.json() as { id?: unknown; authorized?: unknown; reply?: unknown };
    if (typeof body.id !== "string" || !uuid.test(body.id)) return NextResponse.json({ error: "Chamado inválido." }, { status: 400, headers });
    const { data: ticket, error: ticketError } = await admin.from("support_tickets").select("id,myka_authorized").eq("id",body.id).maybeSingle();
    if (ticketError) throw ticketError;
    if (!ticket) return NextResponse.json({ error: "Chamado não encontrado." }, { status: 404, headers });
    if (typeof body.authorized === "boolean") {
      const { error: updateError } = await admin.from("support_tickets").update({ myka_authorized: body.authorized }).eq("id",body.id);
      if (updateError) throw updateError;
      return NextResponse.json({ authorized: body.authorized }, { headers });
    }
    if (typeof body.reply === "string") {
      const reply = body.reply.trim();
      if (!ticket.myka_authorized) return NextResponse.json({ error: "Autorize a MYKA neste chamado antes de enviar." }, { status: 403, headers });
      if (!reply || reply.length > 3000) return NextResponse.json({ error: "Resposta inválida." }, { status: 400, headers });
      const { error: insertError } = await admin.from("support_ticket_replies").insert({ ticket_id: body.id, author_type: "myka", author_id: user.id, body: reply });
      if (insertError) throw insertError;
      return NextResponse.json({ sent: true }, { headers });
    }
    return NextResponse.json({ error: "Operação inválida." }, { status: 400, headers });
  } catch {
    return NextResponse.json({ error: "Operação indisponível." }, { status: 503, headers });
  }
}
