import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const allowedSources = new Set(["registration", "google_onboarding", "settings"]);

export async function POST(request: Request) {
  const client = await createClient();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError || !auth.user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "Serviço indisponível." }, { status: 503 });
  const service = createAdminClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  let payload: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw Error("invalid");
    payload = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }
  const { purposeKey, purposeVersion, granted, noticeVersionId, requestId, source } = payload;
  if (typeof purposeKey !== "string" || !/^[a-z][a-z0-9_]{1,63}$/.test(purposeKey) ||
      !Number.isSafeInteger(purposeVersion) || Number(purposeVersion) <= 0 ||
      typeof granted !== "boolean" || typeof noticeVersionId !== "string" ||
      !uuidPattern.test(noticeVersionId) || typeof requestId !== "string" ||
      !uuidPattern.test(requestId) || typeof source !== "string" || !allowedSources.has(source)) {
    return NextResponse.json({ error: "Escolha inválida." }, { status: 400 });
  }
  const [purposeResult, noticeResult] = await Promise.all([
    service.from("myryra_privacy_purposes").select("purpose_key,purpose_version,required,active,legal_basis")
      .eq("purpose_key", purposeKey).eq("purpose_version", purposeVersion).maybeSingle(),
    service.from("myryra_privacy_document_versions").select("id,status,document_type,published_at,effective_at")
      .eq("id", noticeVersionId).maybeSingle(),
  ]);
  if (purposeResult.error || noticeResult.error) return NextResponse.json({ error: "Não foi possível validar a finalidade." }, { status: 503 });
  const purpose = purposeResult.data;
  const notice = noticeResult.data;
  if (!purpose || !purpose.active || purpose.required || purpose.legal_basis !== "consent" ||
      !notice || notice.status !== "published" || notice.document_type !== "privacy_notice" ||
      !notice.published_at || new Date(notice.effective_at).getTime() > Date.now()) {
    return NextResponse.json({ error: "Finalidade ou aviso não disponível para consentimento." }, { status: 409 });
  }
  const { data: existing, error: existingError } = await service.from("myryra_privacy_choices")
    .select("id,purpose_key,purpose_version,granted,notice_version_id")
    .eq("user_id", auth.user.id).eq("request_id", requestId).maybeSingle();
  if (existingError) return NextResponse.json({ error: "Não foi possível verificar a solicitação." }, { status: 503 });
  if (existing) {
    if (existing.purpose_key !== purposeKey || existing.purpose_version !== purposeVersion ||
        existing.granted !== granted || existing.notice_version_id !== noticeVersionId)
      return NextResponse.json({ error: "Identificador já utilizado." }, { status: 409 });
    return NextResponse.json({ id: existing.id, alreadyRecorded: true });
  }
  const { data, error } = await service.from("myryra_privacy_choices").insert({
    user_id: auth.user.id, purpose_key: purposeKey, purpose_version: purposeVersion,
    granted, notice_version_id: noticeVersionId, source, request_id: requestId,
  }).select("id").single();
  if (error) return NextResponse.json({ error: "Não foi possível registrar a escolha." }, { status: 503 });
  return NextResponse.json({ id: data.id, alreadyRecorded: false }, { status: 201 });
}
