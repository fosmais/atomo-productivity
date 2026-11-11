import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Context = { params: Promise<{ id: string }> };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

async function authorizedJourney(context: Context) {
  const { id } = await context.params;
  if (!UUID.test(id)) return { response: NextResponse.json({ error: "Identificador de meta inválido." }, { status: 400 }) };
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { response: NextResponse.json({ error: "Autenticação necessária." }, { status: 401 }) };
  const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error || (assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2")) {
    return { response: NextResponse.json({ error: "Verificação adicional necessária." }, { status: 403 }) };
  }
  const { data: journey, error: lookupError } = await supabase.from("myryra_journeys")
    .select("id,status").eq("id", id).eq("owner_id", user.id).maybeSingle();
  if (lookupError) return { response: NextResponse.json({ error: "Não foi possível consultar a meta." }, { status: 500 }) };
  if (!journey || journey.status === "archived") return { response: NextResponse.json({ error: "Meta não encontrada." }, { status: 404 }) };
  return { supabase, user, id };
}

export async function PATCH(request: NextRequest, context: Context) {
  const access = await authorizedJourney(context);
  if (access.response) return access.response;
  let payload: unknown;
  try { payload = await request.json(); }
  catch { return NextResponse.json({ error: "Dados inválidos." }, { status: 400 }); }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }
  const body = payload as Record<string, unknown>;
  if (typeof body.title !== "string" || !body.title.trim() || body.title.trim().length > 120) {
    return NextResponse.json({ error: "Informe um nome de meta de até 120 caracteres." }, { status: 400 });
  }
  const targetDate = body.targetDate;
  if (targetDate !== null && (typeof targetDate !== "string" || !DATE.test(targetDate) ||
    Number.isNaN(Date.parse(targetDate)) || new Date(targetDate).toISOString().slice(0, 10) !== targetDate)) {
    return NextResponse.json({ error: "Data-alvo inválida." }, { status: 400 });
  }
  const { data, error } = await access.supabase!.from("myryra_journeys")
    .update({ title: body.title.trim(), target_date: targetDate, updated_at: new Date().toISOString() })
    .eq("id", access.id!).eq("owner_id", access.user!.id).neq("status", "archived")
    .select("id,title,status,target_date").maybeSingle();
  if (error) return NextResponse.json({ error: "Não foi possível salvar a meta." }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Meta não encontrada." }, { status: 404 });
  return NextResponse.json({ journey: data, message: "Meta atualizada." }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function DELETE(_request: NextRequest, context: Context) {
  const access = await authorizedJourney(context);
  if (access.response) return access.response;
  const { data, error } = await access.supabase!.from("myryra_journeys")
    .update({ status: "archived", updated_at: new Date().toISOString() })
    .eq("id", access.id!).eq("owner_id", access.user!.id).neq("status", "archived")
    .select("id").maybeSingle();
  if (error) return NextResponse.json({ error: "Não foi possível arquivar a meta." }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Meta não encontrada." }, { status: 404 });
  return NextResponse.json({ message: "Meta removida da lista. Histórico e MYRAs preservados." }, { headers: { "Cache-Control": "private, no-store" } });
}
