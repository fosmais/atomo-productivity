import "server-only";
import { createClient } from "@/lib/supabase/server";

/** Optional consent only; never substitutes for per-action authorization. */
export async function hasCurrentOptionalConsent(userId: string, purposeKey: string): Promise<boolean> {
  if (!userId || !/^[a-z][a-z0-9_]{1,63}$/.test(purposeKey)) return false;
  try {
    const client = await createClient();
    const { data: auth, error: authError } = await client.auth.getUser();
    if (authError || auth.user?.id !== userId) return false;
    const { data: purpose, error: purposeError } = await client.from("myryra_privacy_purposes")
      .select("purpose_version,required,legal_basis").eq("purpose_key", purposeKey)
      .eq("active", true).order("purpose_version", { ascending: false }).limit(1).maybeSingle();
    if (purposeError || !purpose || purpose.required || purpose.legal_basis !== "consent") return false;
    const { data: choices, error: choiceError } = await client.from("myryra_privacy_choices")
      .select("granted,occurred_at").eq("user_id", userId).eq("purpose_key", purposeKey)
      .eq("purpose_version", purpose.purpose_version).order("occurred_at", { ascending: false }).order("granted", { ascending: true }).limit(1);
    if (choiceError || !choices?.length || choices[0].granted !== true) return false;
    // Revocation wins when multiple decisions share the latest timestamp.
    return true;
  } catch { return false; }
}
