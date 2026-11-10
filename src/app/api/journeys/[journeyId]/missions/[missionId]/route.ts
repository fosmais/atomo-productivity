import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Context = { params: Promise<{ journeyId: string; missionId: string }> };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PATCH(request: Request, context: Context) {
  const { journeyId, missionId } = await context.params;
  if (!uuid.test(journeyId) || !uuid.test(missionId)) {
    return NextResponse.json({ error: "Identificador inválido." }, { status: 400 });
  }
  if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) {
    return NextResponse.json({ error: "Envie JSON." }, { status: 415 });
  }
  let body: unknown;
  try {
    const raw = await request.text();
    if (raw.length > 512) return NextResponse.json({ error: "Solicitação muito grande." }, { status: 413 });
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body) ||
      !("status" in body) ||
      ((body as { status: unknown }).status !== "completed" &&
       (body as { status: unknown }).status !== "pending")) {
    return NextResponse.json({ error: "Status inválido." }, { status: 400 });
  }
  const status = (body as { status: "pending" | "completed" }).status;
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
  const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error || (assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2"))
    return NextResponse.json({ error: "Verificação adicional necessária." }, { status: 403 });

  const { data: journey, error: journeyError } = await supabase.from("myryra_journeys")
    .select("id").eq("id", journeyId).eq("owner_id", user.id).maybeSingle();
  if (journeyError) return NextResponse.json({ error: "Falha ao verificar jornada." }, { status: 500 });
  if (!journey) return NextResponse.json({ error: "Jornada não encontrada." }, { status: 404 });

  const { data: mission, error: updateError } = await supabase.from("myryra_journey_missions")
    .update({ status, completed_at: status === "completed" ? new Date().toISOString() : null })
    .eq("id", missionId).eq("journey_id", journeyId)
    .select("id,title,status,completed_at").maybeSingle();
  if (updateError) return NextResponse.json({ error: "Não foi possível atualizar a missão." }, { status: 500 });
  if (!mission) return NextResponse.json({ error: "Missão não encontrada." }, { status: 404 });
  return NextResponse.json({ mission }, { headers: { "Cache-Control": "private, no-store" } });
}
