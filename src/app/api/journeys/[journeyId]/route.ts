import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Context = { params: Promise<{ journeyId: string }> };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(_request: Request, context: Context) {
  const { journeyId } = await context.params;
  if (!uuid.test(journeyId)) return NextResponse.json({ error: "Jornada inválida." }, { status: 400 });
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
  const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error || (assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2"))
    return NextResponse.json({ error: "Verificação adicional necessária." }, { status: 403 });
  const { data: journey, error: journeyError } = await supabase.from("myryra_journeys")
    .select("id,title,status,target_date").eq("id", journeyId).eq("owner_id", user.id).maybeSingle();
  if (journeyError) return NextResponse.json({ error: "Falha ao consultar jornada." }, { status: 500 });
  if (!journey) return NextResponse.json({ error: "Jornada não encontrada." }, { status: 404 });
  const { data: missions, error: missionsError } = await supabase.from("myryra_journey_missions")
    .select("id,title,status,due_at,completed_at,created_at").eq("journey_id", journeyId)
    .order("created_at", { ascending: true }).limit(104);
  if (missionsError) return NextResponse.json({ error: "Falha ao consultar missões." }, { status: 500 });
  return NextResponse.json({ journey, missions: missions ?? [] }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}

async function changeJourney(request: Request, context: Context, archive: boolean) {
  const { journeyId } = await context.params;
  if (!uuid.test(journeyId)) return NextResponse.json({ error: "Jornada inválida." }, { status: 400 });
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
  const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error || (assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2"))
    return NextResponse.json({ error: "Verificação adicional necessária." }, { status: 403 });
  let updates: { title?: string; target_date?: string | null; status?: string; updated_at: string } = { updated_at: new Date().toISOString() };
  if (archive) {
    updates.status = "archived";
  } else {
    let body: unknown;
    try { body = await request.json(); } catch { return NextResponse.json({ error: "Dados inválidos." }, { status: 400 }); }
    if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
    const data = body as Record<string, unknown>;
    if (typeof data.title !== "string" || !data.title.trim() || data.title.trim().length > 120)
      return NextResponse.json({ error: "Informe um nome entre 1 e 120 caracteres." }, { status: 400 });
    updates.title = data.title.trim().replace(/\s+/g, " ");
    if (data.targetDate !== undefined) {
      if (data.targetDate !== null && (typeof data.targetDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(data.targetDate) ||
        Number.isNaN(Date.parse(data.targetDate + "T12:00:00Z")) ||
        new Date(data.targetDate + "T12:00:00Z").toISOString().slice(0, 10) !== data.targetDate))
        return NextResponse.json({ error: "Data-alvo inválida." }, { status: 400 });
      updates.target_date = data.targetDate;
    }
  }
  const { data, error } = await supabase.from("myryra_journeys").update(updates)
    .eq("id", journeyId).eq("owner_id", user.id).neq("status", "archived")
    .select("id,title,status,target_date").maybeSingle();
  if (error) return NextResponse.json({ error: "Não foi possível atualizar a meta." }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Meta não encontrada ou já excluída." }, { status: 404 });
  return NextResponse.json({ journey: data, archived: archive, message: archive
    ? "Meta removida da lista. Histórico e MYRAs preservados."
    : "Meta atualizada. Missões e MYRAs preservados." }, { headers: { "Cache-Control": "private, no-store" } });
}
export async function PATCH(request: Request, context: Context) { return changeJourney(request, context, false); }
export async function DELETE(request: Request, context: Context) { return changeJourney(request, context, true); }
