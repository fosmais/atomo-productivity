import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Context = { params: Promise<{ journeyId: string }> };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BUCKET = "journey-achievements";
const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

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
    .select("id,title,message,photo_path,achieved_at")
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
  let form: FormData;
  try { form = await request.formData(); } catch { return NextResponse.json({ error: "Formulário inválido." }, { status: 400 }); }
  const rawMessage = form.get("message");
  if (typeof rawMessage !== "string" || rawMessage.length > 500)
    return NextResponse.json({ error: "Mensagem inválida." }, { status: 400 });
  const image = form.get("photo");
  if (image !== null && (!(image instanceof File) || !TYPES[image.type] || image.size === 0 || image.size > 5 * 1024 * 1024))
    return NextResponse.json({ error: "Foto inválida. Use JPG, PNG ou WebP de até 5 MB." }, { status: 400 });
  const photo = image instanceof File ? image : null;
  const path = photo ? user.id + "/" + journeyId + "/" + crypto.randomUUID() + "." + TYPES[photo.type] : null;
  if (photo && path) {
    const { error: uploadError } = await supabase.storage.from(BUCKET)
      .upload(path, photo, { contentType: photo.type, upsert: false });
    if (uploadError) return NextResponse.json({ error: "Não foi possível salvar a foto." }, { status: 503 });
  }
  const { data, error } = await supabase.from("myryra_journey_achievements")
    .insert({ journey_id: journeyId, owner_id: user.id, title: journey.title, message: rawMessage.trim(), photo_path: path })
    .select("id,title,message,achieved_at").single();
  if (error) {
    if (path) await supabase.storage.from(BUCKET).remove([path]);
    return NextResponse.json({ error: "Não foi possível registrar a conquista." }, { status: 503 });
  }
  return NextResponse.json({ achievement: data }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
}
