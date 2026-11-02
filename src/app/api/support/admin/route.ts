import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const headers = { "Cache-Control": "private, no-store" };
async function authorize() {
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return { error: NextResponse.json({ error: "Autenticação necessária." }, { status: 401, headers }) };
  const assurance = await client.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error || (assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2")) {
    return { error: NextResponse.json({ error: "Verificação de segurança necessária." }, { status: 403, headers }) };
  }
  const admin = createSupabaseAdmin();
  const { data, error: lookupError } = await admin.from("support_admins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (lookupError || !data) return { error: NextResponse.json({ error: "Acesso não autorizado." }, { status: 403, headers }) };
  return { admin };
}

export async function GET() {
  try {
    const access = await authorize();
    if (access.error) return access.error;
    const { data, error } = await access.admin!.from("support_tickets")
      .select("id,subject,message,category,status,priority,created_at,updated_at")
      .order("created_at", { ascending: false }).limit(100);
    if (error) throw error;
    return NextResponse.json({ tickets: data ?? [] }, { headers });
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
    const { data, error } = await access.admin!.from("support_tickets").update(changes).eq("id", id).select("id,status,priority,updated_at").maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Chamado não encontrado." }, { status: 404, headers });
    return NextResponse.json({ ticket: data }, { headers });
  } catch {
    return NextResponse.json({ error: "Atualização indisponível." }, { status: 503, headers });
  }
}
