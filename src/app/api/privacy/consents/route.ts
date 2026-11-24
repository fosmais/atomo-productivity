import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";


async function sessionUser() {
  const client = await createClient();
  const { data, error } = await client.auth.getUser();
  return error ? null : data.user;
}

export async function GET() {
  const user = await sessionUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const client = await createClient();
  const [acceptances, choices] = await Promise.all([
    client.from("myryra_privacy_acceptances").select("id,document_version_id,action,occurred_at,evidence_source").eq("user_id", user.id).order("occurred_at", { ascending: false }).limit(100),
    client.from("myryra_privacy_choices").select("id,purpose_key,purpose_version,granted,occurred_at").eq("user_id", user.id).order("occurred_at", { ascending: false }).limit(200),
  ]);
  if (acceptances.error || choices.error) return NextResponse.json({ error: "Histórico indisponível." }, { status: 503 });
  return NextResponse.json({ acceptances: acceptances.data, choices: choices.data }, { headers: { "Cache-Control": "no-store" } });
}

