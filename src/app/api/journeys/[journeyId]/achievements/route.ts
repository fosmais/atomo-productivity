import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Context = { params: Promise<{ journeyId: string }> };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BUCKET = "journey-achievements";
const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

async function matchesImageSignature(file: File): Promise<boolean> {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (file.type === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (file.type === "image/png") return bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte);
  if (file.type === "image/webp") return bytes.length >= 12 &&
    [82, 73, 70, 70].every((byte, index) => bytes[index] === byte) &&
    [87, 69, 66, 80].every((byte, index) => bytes[index + 8] === byte);
  return false;
}

async function authorize(journeyId: string) {
  if (!UUID.test(journeyId)) return { error: NextResponse.json({ error: "Jornada inválida." }, { status: 400 }) };
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { error: NextResponse.json({ error: "Autenticação necessária." }, { status: 401 }) };
  const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error || (assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2"))
    return { error: NextResponse.json({ error: "Verificação adicional necessária." }, { status: 403 }) };
  const { data: journey, error: journeyError } = await supabase.from("myryra_journeys")
    .select("id,title").eq("id", journeyId).eq("owner_id", user.id).maybeSingle();
  if (journeyError || !journey) return { error: NextResponse.json({ error: "Jornada não encontrada." }, { status: 404 }) };
  return { supabase, user, journey };
}

export async function GET(_request: Request, context: Context) {
  const { journeyId } = await context.params;
  const auth = await authorize(journeyId);
  if (auth.error) return auth.error;
  const { supabase, user } = auth;
  if (!supabase || !user) return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
  const { data, error } = await supabase.from("myryra_journey_achievements")
    .select("id,title,message,photo_path,achieved_at,completed_missions_at_achievement,myra_earned_at_achievement")
    .eq("journey_id", journeyId).eq("owner_id", user.id)
    .order("achieved_at", { ascending: false }).limit(30);
  if (error) return NextResponse.json({ error: "Galeria indisponível." }, { status: 503 });
  const achievements = await Promise.all((data ?? []).map(async item => {
    if (!item.photo_path) return { ...item, photo_url: null };
    const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(item.photo_path, 300);
    return { ...item, photo_url: signed?.signedUrl ?? null };
  }));
  return NextResponse.json({ achievements }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request, context: Context) {
  const { journeyId } = await context.params;
  const auth = await authorize(journeyId);
  if (auth.error) return auth.error;
  const { supabase, user, journey } = auth;
  if (!supabase || !user || !journey) return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
  const { data: missions, error: missionsError } = await supabase.from("myryra_journey_missions")
    .select("status").eq("journey_id", journeyId).limit(105);
  if (missionsError || !missions?.length || missions.length > 104 || missions.some(m => m.status !== "completed"))
    return NextResponse.json({ error: "Conclua sua jornada antes de registrar a conquista." }, { status: 409 });
  // Read only credits already recorded in the ledger. Saving a memory never awards MYRA.
  let myraEarned = 0;
  for (let offset = 0; ; offset += 1000) {
    const { data: credits, error: creditsError } = await supabase.from("myryra_journey_myra_ledger")
      .select("amount").eq("owner_id", user.id).eq("journey_id", journeyId)
      .range(offset, offset + 999);
    if (creditsError) return NextResponse.json({ error: "Não foi possível confirmar o histórico de MYRAs." }, { status: 503 });
    const entries = credits ?? [];
    myraEarned += entries.reduce((sum, entry) => sum + entry.amount, 0);
    if (entries.length < 1000) break;
  }
  if (!Number.isSafeInteger(myraEarned) || myraEarned < 0)
    return NextResponse.json({ error: "Saldo histórico de MYRAs inválido." }, { status: 503 });
  let form: FormData;
  try { form = await request.formData(); } catch { return NextResponse.json({ error: "Formulário inválido." }, { status: 400 }); }
  const rawMessage = form.get("message");
  if (typeof rawMessage !== "string" || rawMessage.length > 500)
    return NextResponse.json({ error: "Mensagem inválida." }, { status: 400 });
  const image = form.get("photo");
  if (image !== null && (!(image instanceof File) || !TYPES[image.type] || image.size === 0 || image.size > 5 * 1024 * 1024))
    return NextResponse.json({ error: "Foto inválida. Use JPG, PNG ou WebP de até 5 MB." }, { status: 400 });
  const photo = image instanceof File ? image : null;
  if (photo && !(await matchesImageSignature(photo)))
    return NextResponse.json({ error: "O conteúdo do arquivo não corresponde a uma imagem JPG, PNG ou WebP válida." }, { status: 400 });
  const path = photo ? user.id + "/" + journeyId + "/" + crypto.randomUUID() + "." + TYPES[photo.type] : null;
  if (photo && path) {
    const { error: uploadError } = await supabase.storage.from(BUCKET)
      .upload(path, photo, { contentType: photo.type, upsert: false });
    if (uploadError) return NextResponse.json({ error: "Não foi possível salvar a foto." }, { status: 503 });
  }
  const { data, error } = await supabase.from("myryra_journey_achievements")
    .insert({ journey_id: journeyId, owner_id: user.id, title: journey.title, message: rawMessage.trim(), photo_path: path, completed_missions_at_achievement: missions.length, myra_earned_at_achievement: myraEarned })
    .select("id,title,message,achieved_at,completed_missions_at_achievement,myra_earned_at_achievement").single();
  if (error) {
    if (path) await supabase.storage.from(BUCKET).remove([path]);
    return NextResponse.json({ error: "Não foi possível registrar a conquista." }, { status: 503 });
  }
  return NextResponse.json({ achievement: data }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
}
