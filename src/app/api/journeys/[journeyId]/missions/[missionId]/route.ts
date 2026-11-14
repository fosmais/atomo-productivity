import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasCurrentLegalAcceptance } from "@/lib/privacy/legal-acceptance";

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
  // Allow undoing a completion even without acceptance; new rewards require current consent.
  if (status === "completed" &&
      process.env.MYRYRA_LEGAL_ACCEPTANCE_GATE_ENABLED === "true" &&
      !(await hasCurrentLegalAcceptance(user.id))) {
    return NextResponse.json(
      { error: "Aceite dos documentos legais vigentes necessário.", code: "LEGAL_ACCEPTANCE_REQUIRED" },
      { status: 403, headers: { "Cache-Control": "private, no-store" } },
    );
  }
  const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error || (assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2"))
    return NextResponse.json({ error: "Verificação adicional necessária." }, { status: 403 });

  const { data: journey, error: journeyError } = await supabase.from("myryra_journeys")
    .select("id,status").eq("id", journeyId).eq("owner_id", user.id).maybeSingle();
  if (journeyError) return NextResponse.json({ error: "Falha ao verificar jornada." }, { status: 500 });
  if (!journey) return NextResponse.json({ error: "Jornada não encontrada." }, { status: 404 });
  if (journey.status !== "active") return NextResponse.json({ error: "Retome a jornada antes de alterar suas missões." }, { status: 409 });

  // Verify the mission belongs to this authenticated user's journey before any ledger lookup or mutation.
  const { data: existingMission, error: missionLookupError } = await supabase.from("myryra_journey_missions")
    .select("id,status").eq("id", missionId).eq("journey_id", journeyId).maybeSingle();
  if (missionLookupError) return NextResponse.json({ error: "Falha ao verificar missão." }, { status: 500 });
  if (!existingMission) return NextResponse.json({ error: "Missão não encontrada." }, { status: 404 });
  if (existingMission.status === status)
    return NextResponse.json({ mission: existingMission, myraAwarded: false }, { headers: { "Cache-Control": "private, no-store" } });

  // Learning missions must have a persisted MIKA review before they can be completed.
  // This is a submission gate, NOT an assessment pass/fail decision.
  const educationalMission = /IA, machine learning e IA generativa|diferença entre IA, ML e modelos generativos|treino, validação, teste|vazamento|vieses|classificação, regressão|métricas de avaliação|métricas adequadas|prompts estruturados|respostas de IA|embeddings|RAG|busca semântica|fontes verificáveis|LGPD|uso responsável|privacidade, segurança|riscos e controles|pequeno projeto aplicado|problema, dados, indicadores|protótipo viável|apresentar o projeto|demonstração curta/i;
  if (status === "completed") {
    const { data: missionDetails, error: detailsError } = await supabase.from("myryra_journey_missions")
      .select("title").eq("id", missionId).eq("journey_id", journeyId).maybeSingle();
    if (detailsError || !missionDetails) return NextResponse.json({ error: "Falha ao verificar conteúdo da missão." }, { status: 500 });
    // Explicit policies can add assessment requirements but cannot bypass the legacy gate.
    // Fail closed when the policy schema is unavailable in this candidate release.
    const { data: policy, error: policyError } = await supabase
      .from("myryra_journey_mission_assessment_policy")
      .select("requires_assessment,minimum_score")
      .eq("mission_id", missionId).eq("owner_id", user.id).maybeSingle();
    if (policyError) return NextResponse.json({ error: "Política de avaliação indisponível." }, { status: 503 });
    const requiresAssessment = educationalMission.test(missionDetails.title) || policy?.requires_assessment === true;
    const minimumScore = policy?.minimum_score ?? 70;
    if (requiresAssessment) {
      const { data: learning, error: learningError } = await supabase.from("myryra_journey_learning_progress")
        .select("answer,feedback,assessment_passed,assessment_score").eq("mission_id", missionId).eq("owner_id", user.id).maybeSingle();
      if (learningError) return NextResponse.json({ error: "Não foi possível verificar a avaliação da MIKA." }, { status: 503 });
      if (!learning?.answer?.trim() || !learning?.feedback?.trim() || learning.assessment_passed !== true || typeof learning.assessment_score !== "number" || learning.assessment_score < minimumScore)
        return NextResponse.json({ error: `Para concluir esta aula, responda ao exercício e obtenha pelo menos ${minimumScore} pontos na avaliação salva da MIKA. Se necessário, revise o conteúdo e tente novamente.` }, { status: 409 });
    }
  }

  const { data: existingCredit, error: creditLookupError } = status === "completed"
    ? await supabase.from("myryra_journey_myra_ledger").select("mission_id").eq("owner_id", user.id).eq("mission_id", missionId).maybeSingle()
    : { data: null, error: null };
  if (creditLookupError) return NextResponse.json({ error: "Falha ao verificar recompensa." }, { status: 500 });

  const { data: mission, error: updateError } = await supabase.from("myryra_journey_missions")
    .update({ status, completed_at: status === "completed" ? new Date().toISOString() : null })
    .eq("id", missionId).eq("journey_id", journeyId).eq("status", existingMission.status)
    .select("id,title,status,completed_at").maybeSingle();
  if (updateError) return NextResponse.json({ error: "Não foi possível atualizar a missão." }, { status: 500 });
  if (!mission) return NextResponse.json({ error: "A missão foi alterada por outra operação. Atualize a jornada e tente novamente." }, { status: 409 });
  const { data: confirmedCredit, error: rewardError } = status === "completed" && !existingCredit
    ? await supabase.from("myryra_journey_myra_ledger").select("mission_id").eq("owner_id", user.id).eq("mission_id", missionId).maybeSingle()
    : { data: null, error: null };
  return NextResponse.json({ mission, myraAwarded: !rewardError && !!confirmedCredit && !existingCredit }, { headers: { "Cache-Control": "private, no-store" } });
}
