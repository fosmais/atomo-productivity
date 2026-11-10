import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createJourneyDraft } from "@/lib/journey/create-journey-draft";

type Context = { params: Promise<{ journeyId: string }> };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Read-only preview. Never deletes missions or touches the MYRA ledger. */
export async function POST(_request: Request, context: Context) {
  const { journeyId } = await context.params;
  if (!uuid.test(journeyId)) return NextResponse.json({ error: "Jornada inválida." }, { status: 400 });
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
  const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error || (assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2"))
    return NextResponse.json({ error: "Verificação adicional necessária." }, { status: 403 });
  const { data: journey, error: journeyError } = await supabase.from("myryra_journeys")
    .select("id,title,target_date").eq("id", journeyId).eq("owner_id", user.id).maybeSingle();
  if (journeyError) return NextResponse.json({ error: "Falha ao consultar jornada." }, { status: 500 });
  if (!journey) return NextResponse.json({ error: "Jornada não encontrada." }, { status: 404 });
  const { data: missions, error: missionError } = await supabase.from("myryra_journey_missions")
    .select("id,title,status").eq("journey_id", journeyId).order("created_at", { ascending: true }).limit(104);
  if (missionError) return NextResponse.json({ error: "Falha ao consultar missões." }, { status: 500 });
  const completed = (missions ?? []).filter(m => m.status === "completed");
  // A short, practical preview is preferable to reproducing 50 generic cards.
  // Keep the original deadline when it is still actionable.
  // Expired deadlines must not crash the preview.
  const today = new Date();
  const todayUtc = today.toISOString().slice(0, 10);
  const targetDate = journey.target_date && journey.target_date >= todayUtc
    ? journey.target_date : undefined;
  const draft = createJourneyDraft({ title: journey.title, targetDate }, today);
  // Do not ask the user to redo an already completed mission.
  // Compare normalized titles while keeping the original achievements untouched.
  const normalizedTitle = (value: string) => value.normalize("NFD")
    .replace(/[\\u0300-\\u036f]/g, "").trim().replace(/\\s+/g, " ").toLowerCase();
  const completedTitles = new Set(completed.map(m => normalizedTitle(m.title)));
  const proposed = draft.missions
    .filter(m => !completedTitles.has(normalizedTitle(m.title)))
    .map(m => ({ title: m.title, week: m.week }));
  return NextResponse.json({
    previewOnly: true,
    journeyId,
    preserved: { completed: completed.map(m => ({ id: m.id, title: m.title })), existingMissionCount: missions?.length ?? 0 },
    proposed,
    planning: {
      targetDate: targetDate ?? null,
      originalTargetDate: journey.target_date,
      deadlineNeedsReview: Boolean(journey.target_date && !targetDate),
      remainingMissions: (missions ?? []).filter(m => m.status !== "completed").length,
    },
    message: "Prévia apenas. Nenhuma missão, conquista ou MYRA foi alterada.",
  }, { headers: { "Cache-Control": "private, no-store" } });
}
