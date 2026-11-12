import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Reschedule or clear a reminder-free lesson date. Does not create calendar events. */
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
  const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error) return NextResponse.json({ error: "Verificação indisponível." }, { status: 503 });
  if (assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2")
    return NextResponse.json({ error: "Verificação adicional necessária." }, { status: 403 });
  if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json"))
    return NextResponse.json({ error: "Envie JSON." }, { status: 415 });
  let input: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (raw.length > 512) return NextResponse.json({ error: "Solicitação muito grande." }, { status: 413 });
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw Error("invalid");
    input = parsed as Record<string, unknown>;
  } catch { return NextResponse.json({ error: "JSON inválido." }, { status: 400 }); }
  if (typeof input.sessionId !== "string" || !uuid.test(input.sessionId) ||
      !(input.scheduledAt === null || (typeof input.scheduledAt === "string" &&
        /^\\d{4}-\\d\\d-\\d\\dT\\d\\d:\\d\\d:\\d\\d(?:\\.\\d+)?(?:Z|[+-]\\d\\d:\\d\\d)$/.test(input.scheduledAt) &&
        Number.isFinite(Date.parse(input.scheduledAt)) &&
        Date.parse(input.scheduledAt) >= Date.now() + 60000 &&
        Date.parse(input.scheduledAt) <= Date.now() + 366 * 86400000)))
    return NextResponse.json({ error: "Data ou aula inválida." }, { status: 400 });
  const { data, error } = await supabase.from("mika_teacher_sessions")
    .update({ scheduled_at: input.scheduledAt })
    .eq("id", input.sessionId).eq("owner_id", user.id).eq("status", "active")
    .select("id,scheduled_at").maybeSingle();
  if (error) return NextResponse.json({ error: "Não foi possível reagendar a aula." }, { status: 503 });
  if (!data) return NextResponse.json({ error: "Aula não encontrada ou não está ativa." }, { status: 404 });
  return NextResponse.json({ session: data }, { headers: { "Cache-Control": "private, no-store" } });
}
