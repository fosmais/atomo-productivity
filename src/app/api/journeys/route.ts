import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
  }
  const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error ||
      (assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2")) {
    return NextResponse.json({ error: "Verificação adicional necessária." }, { status: 403 });
  }
  const { data, error: queryError } = await supabase
    .from("myryra_journeys")
    .select("id,title,status,target_date,created_at")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);
  if (queryError) {
    return NextResponse.json({ error: "Não foi possível consultar suas jornadas." }, { status: 500 });
  }
  return NextResponse.json({ journeys: data ?? [] }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
