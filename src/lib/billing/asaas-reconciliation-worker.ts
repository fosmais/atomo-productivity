import "server-only";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { verifyAsaasSandboxPaymentForReconciliation } from "@/lib/billing/asaas-reconciliation-verify";

/**
 * Processes at most one leased job per invocation. This is audit-only:
 * even a verified payment does not activate a plan or mutate entitlements.
 * Invoke only from a separately authenticated internal scheduler.
 */
export async function processOneAsaasSandboxReconciliationJob():
  Promise<{ processed: boolean; state?: string }> {
  if (process.env.ASAAS_ENVIRONMENT !== "sandbox" ||
      process.env.ASAAS_RECONCILIATION_WORKER_ENABLED !== "true") {
    throw new Error("Worker de conciliação desabilitado.");
  }
  const admin = createSupabaseAdmin();
  const { data, error } = await admin.rpc("claim_asaas_reconciliation_job", {
    p_lease_seconds: 120,
  });
  if (error) throw new Error("Falha ao reservar trabalho de conciliação.");
  const job = Array.isArray(data) ? data[0] : null;
  if (!job) return { processed: false };
  if (job.provider !== "asaas" || typeof job.provider_payment_id !== "string" ||
      typeof job.id !== "number" || !job.locked_until) {
    throw new Error("Trabalho de conciliação inconsistente.");
  }
  const attempts = Number(job.attempts || 0) + 1;
  let state: "verified" | "rejected" | "retry" = "rejected";
  let code: string | null = null;
  try {
    const result = await verifyAsaasSandboxPaymentForReconciliation(job.provider_payment_id);
    state = result.verified ? "verified" : "rejected";
    code = result.verified ? null : result.reason;
  } catch {
    state = attempts >= 5 ? "rejected" : "retry";
    code = attempts >= 5 ? "MAX_RETRIES" : "VERIFICATION_UNAVAILABLE";
  }
  const nextAttemptAt = state === "retry"
    ? new Date(Date.now() + Math.min(60, 2 ** attempts) * 60_000).toISOString()
    : new Date().toISOString();
  const { data: completed, error: completeError } = await admin.rpc(
    "complete_asaas_reconciliation_job",
    {
      p_job_id: job.id,
      p_expected_locked_until: job.locked_until,
      p_state: state,
      p_attempts: attempts,
      p_next_attempt_at: nextAttemptAt,
      p_error_code: code,
    },
  );
  if (completeError || completed !== true) {
    throw new Error("Falha ao concluir trabalho de conciliação.");
  }
  return { processed: true, state };
}
