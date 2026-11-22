import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const client = await createClient();
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user) return NextResponse.json({ error: "Autenticação necessária." }, { status: 401, headers });
    const ticketId = new URL(request.url).searchParams.get("ticket");
    if (!ticketId || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(ticketId)) return NextResponse.json({ error: "Chamado inválido." }, { status: 400, headers });
    const { data: owned, error: ownershipError } = await client.from("support_tickets").select("id").eq("id",ticketId).eq("user_id",user.id).maybeSingle();
    if (ownershipError || !owned) return NextResponse.json({ error: "Chamado não encontrado." }, { status: 404, headers });
    const { data, error: replyError } = await createSupabaseAdmin().from("support_ticket_replies").select("id,body,created_at,author_type").eq("ticket_id",ticketId).order("created_at",{ascending:true}).limit(100);
    if (replyError) throw replyError;
    return NextResponse.json({ replies: data ?? [] }, { headers });
  } catch {
    return NextResponse.json({ error: "Não foi possível consultar respostas." }, { status: 503, headers });
  }
}
