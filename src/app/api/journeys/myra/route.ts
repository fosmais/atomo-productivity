import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
  const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error || (assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2")) {
    return NextResponse.json({ error: "Verificação adicional necessária." }, { status: 403 });
  }
  const { data, error: dbError } = await supabase.from("myryra_journey_myra_ledger")
    .select("amount,created_at,mission_id,journey_id")
    .eq("owner_id", user.id).order("created_at", { ascending: false }).limit(1000);
  if (dbError) return NextResponse.json({ error: "Não foi possível consultar suas MYRAs." }, { status: 500 });
  const entries = data ?? [];
  return NextResponse.json({
    balance: entries.reduce((sum, entry) => sum + entry.amount, 0),
    recent: entries.slice(0, 10),
    unit: "MYRA",
    monetaryValue: false,
  }, { headers: { "Cache-Control": "private, no-store" } });
}
