import "server-only";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { classifyAsaasOperation } = require("./asaas-audit-classification.cjs") as {
  classifyAsaasOperation: (op: { state: string; provider_id: string | null; updated_at: string }, now: number) => {
    unknownState: boolean; completedWithoutProviderId: boolean;
    remoteCreatedWithoutProviderId: boolean; requiresReview: boolean;
  };
};

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
    .select("state,provider_id,updated_at")
    .order("updated_at", { ascending: true }).limit(1000);
  if (error) throw new Error("Falha na auditoria do provisionamento.");
  const counts: Record<ProvisioningState, number> = {
    reserved: 0, remote_created: 0, completed: 0, needs_recovery: 0,
  };
  let unknownStates = 0;
  let requiresReview = 0;
  let completedWithoutProviderId = 0;
  let remoteCreatedWithoutProviderId = 0;
  const now = Date.now();
  for (const op of data ?? []) {
    if (STATES.includes(op.state as ProvisioningState)) {
      counts[op.state as ProvisioningState]++;
    } else {
      unknownStates++;
    }
    const classification = classifyAsaasOperation(op, now);
    if (classification.completedWithoutProviderId) completedWithoutProviderId++;
    if (classification.remoteCreatedWithoutProviderId) remoteCreatedWithoutProviderId++;
    if (classification.requiresReview) requiresReview++;
  }
  return {
    inspected: (data ?? []).length,
    sampleLimit: 1000,
    sampleMayBeTruncated: (data ?? []).length === 1000,
    counts,
    unknownStates,
    requiresReview,
    completedWithoutProviderId,
    remoteCreatedWithoutProviderId,
    // No customer IDs, subscription IDs, names, emails, or CPF/CNPJ.
  };
}
