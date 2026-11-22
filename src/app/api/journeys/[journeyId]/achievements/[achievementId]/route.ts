import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Context = { params: Promise<{ journeyId: string; achievementId: string }> };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function DELETE(_request: Request, context: Context) {
  const { journeyId, achievementId } = await context.params;
  if (!UUID.test(journeyId) || !UUID.test(achievementId))
    return NextResponse.json({ error: "Identificador inválido." }, { status: 400 });
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
  const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error || (assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2"))
    return NextResponse.json({ error: "Verificação adicional necessária." }, { status: 403 });
  const { data: achievement, error: readError } = await supabase.from("myryra_journey_achievements")
    .select("id,photo_path").eq("id", achievementId).eq("journey_id", journeyId).eq("owner_id", user.id).maybeSingle();
  if (readError) return NextResponse.json({ error: "Não foi possível consultar a conquista." }, { status: 503 });
  if (!achievement) return NextResponse.json({ error: "Conquista não encontrada." }, { status: 404 });
  const { error: deleteError } = await supabase.from("myryra_journey_achievements")
    .delete().eq("id", achievementId).eq("journey_id", journeyId).eq("owner_id", user.id);
  if (deleteError) return NextResponse.json({ error: "Não foi possível excluir a conquista." }, { status: 503 });
  let photoCleanupPending = false;
  if (achievement.photo_path) {
    const { error: photoError } = await supabase.storage.from("journey-achievements").remove([achievement.photo_path]);
    photoCleanupPending = !!photoError;
  }
  return NextResponse.json({ deleted: true, photoCleanupPending }, { headers: { "Cache-Control": "private, no-store" } });
}
