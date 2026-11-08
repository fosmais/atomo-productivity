import "server-only";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

type ProvisioningState = "reserved" | "remote_created" | "completed" | "needs_recovery";

const STATES: ProvisioningState[] = [
  "reserved", "remote_created", "completed", "needs_recovery",
];

/**
 * Internal read-only audit for sandbox provisioning. Does not create payments,
 * change operation state, or expose personal data.
 */
export async function auditAsaasSandboxProvisioning() {
  if (process.env.ASAAS_ENVIRONMENT !== "sandbox") {
    throw new Error("Auditoria de provisionamento disponível apenas no Sandbox.");
  }
  const admin = createSupabaseAdmin();
  const { data, error } = await admin.from("asaas_provisioning_operations")
    .select("id,operation_type,state,provider_id,created_at,updated_at")
    .order("created_at", { ascending: false }).limit(1000);
  if (error) throw new Error("Falha na auditoria do provisionamento.");
  const counts: Record<ProvisioningState, number> = {
    reserved: 0, remote_created: 0, completed: 0, needs_recovery: 0,
  };
  let unknownStates = 0;
  let requiresReview = 0;
  let completedWithoutProviderId = 0;
  const now = Date.now();
  for (const op of data ?? []) {
    if (STATES.includes(op.state as ProvisioningState)) {
      counts[op.state as ProvisioningState]++;
    } else {
      unknownStates++;
      requiresReview++;
    }
    if (op.state === "completed" && !op.provider_id) completedWithoutProviderId++;
    if (op.state === "needs_recovery" ||
        (op.state !== "completed" && now - new Date(op.updated_at).getTime() > 15 * 60_000)) {
      requiresReview++;
    }
  }
  return {
    inspected: (data ?? []).length,
    sampleLimit: 1000,
    counts,
    unknownStates,
    requiresReview,
    completedWithoutProviderId,
    // No customer IDs, subscription IDs, names, emails, or CPF/CNPJ.
  };
}
