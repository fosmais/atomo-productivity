import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Explicit click-only acceptance. Do not call this endpoint on page load.
export async function POST(request: Request) {
  if (!(request.headers.get("content-type") || "").toLowerCase().startsWith("application/json"))
    return NextResponse.json({ error: "JSON obrigatório." }, { status: 415 });
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  if (!origin || !host || new URL(origin).host !== host)
    return NextResponse.json({ error: "Origem inválida." }, { status: 403 });

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user)
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const terms = process.env.MYRYRA_TERMS_VERSION;
  const privacy = process.env.MYRYRA_PRIVACY_VERSION;
  if (!terms || !privacy)
    return NextResponse.json({ error: "Documentos não publicados.", code: "LEGAL_NOT_CONFIGURED" }, { status: 503 });

  let body: unknown;
  try {
    if (Number(request.headers.get("content-length") || "0") > 2048)
      return NextResponse.json({ error: "Requisição muito grande." }, { status: 413 });
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body) ||
      !("terms_version" in body) || !("privacy_version" in body) ||
      !("accept_terms" in body) || !("acknowledge_privacy" in body) ||
      body.terms_version !== terms || body.privacy_version !== privacy ||
      body.accept_terms !== true || body.acknowledge_privacy !== true)
    return NextResponse.json({ error: "Confirmação explícita das versões atuais é obrigatória." }, { status: 400 });

  const { error } = await supabase.from("myryra_legal_acceptances").upsert([
    { user_id: user.id, document_type: "terms", document_version: terms },
    { user_id: user.id, document_type: "privacy", document_version: privacy }
  ], { onConflict: "user_id,document_type,document_version", ignoreDuplicates: true });
  if (error)
    return NextResponse.json({ error: "Não foi possível registrar o aceite.", code: "LEGAL_WRITE_FAILED" }, { status: 503 });

  const { data: confirmed, error: verifyError } = await supabase
    .from("myryra_legal_acceptances")
    .select("document_type,document_version")
    .eq("user_id", user.id);
  const accepted = !verifyError && ["terms", "privacy"].every(type =>
    (confirmed ?? []).some(row => row.document_type === type &&
      row.document_version === (type === "terms" ? terms : privacy)));
  if (!accepted)
    return NextResponse.json({ error: "Não foi possível confirmar o aceite." }, { status: 503 });
  return NextResponse.json({ accepted: true }, { headers: { "Cache-Control": "no-store" } });
}
