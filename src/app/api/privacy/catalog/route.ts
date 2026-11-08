import { NextResponse, connection } from "next/server";
import { createClient } from "@/lib/supabase/server";


export async function GET() {
  await connection();
  const client = await createClient();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError || !auth.user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const [purposes, notices] = await Promise.all([
    client.from("myryra_privacy_purposes")
      .select("purpose_key,purpose_version,display_name,description,required,legal_basis")
      .eq("active", true),
    client.from("myryra_privacy_document_versions")
      .select("id,version,public_url,effective_at,published_at")
      .eq("document_type", "privacy_notice").eq("status", "published")
      .lte("effective_at", new Date().toISOString())
      .order("effective_at", { ascending: false }).limit(1),
  ]);
  if (purposes.error || notices.error) return NextResponse.json({ error: "Catálogo indisponível." }, { status: 503 });
  return NextResponse.json({
    purposes: purposes.data ?? [],
    notice: notices.data?.find(n => n.published_at) ?? null,
  }, { headers: { "Cache-Control": "no-store" } });
}
